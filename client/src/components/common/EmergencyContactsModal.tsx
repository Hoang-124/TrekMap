import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  IconShieldAlert,
  IconPhone,
  IconX,
  IconClock,
  IconSearch,
  IconMapPin,
  IconCopy,
  IconCheck,
  IconTrees,
  IconShieldCheck,
} from './SvgIcons.js';
import type { Trail, UserProfile } from '../../types.js';
import { VIETNAM_RANGER_STATIONS, type RangerStationSeed } from '../../data/vietnamDirectory.js';

const SafetyTimerModal = lazy(() =>
  import('../safety/SafetyTimerModal.js').then((m) => ({ default: m.SafetyTimerModal }))
);

interface EmergencyContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: (UserProfile & { _id?: string }) | null;
  trails?: Trail[];
}

type RegionFilter = 'Tất Cả' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';

const REGION_FILTERS: RegionFilter[] = ['Tất Cả', 'Miền Bắc', 'Miền Trung', 'Miền Nam'];

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function extractPrimaryDialPhone(raw: string): string {
  const firstSegment = String(raw || '').split(/[/,;]/)[0] || '';
  return firstSegment.replace(/[^0-9+]/g, '');
}

function getAuthorityMeta(type: RangerStationSeed['authorityType']): {
  label: string;
  color: string;
  textColor: string;
  onColor: string;
} {
  switch (type) {
    case 'national_park':
      return {
        label: 'VQG / KBT',
        color: 'var(--color-primary)',
        textColor: 'var(--color-primary)',
        onColor: 'var(--color-on-primary)',
      };
    case 'ranger_station':
      return {
        label: 'Kiểm Lâm',
        color: 'var(--color-earth)',
        textColor: 'var(--color-earth)',
        onColor: 'var(--color-on-primary)',
      };
    case 'border_guard':
      return {
        label: 'Biên Phòng',
        color: 'var(--color-sky)',
        textColor: 'var(--color-sky)',
        onColor: 'var(--color-on-primary)',
      };
    case 'rescue_center':
    default:
      return {
        label: 'Cứu Nạn 24/7',
        color: 'var(--color-error)',
        textColor: 'var(--color-error-text, var(--color-error))',
        onColor: 'var(--color-on-danger)',
      };
  }
}

export const EmergencyContactsModal: React.FC<EmergencyContactsModalProps> = ({
  isOpen,
  onClose,
  currentUser = null,
  trails = [],
}) => {
  const [isSafetyTimerOpen, setIsSafetyTimerOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('Tất Cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: closeBtnRef });

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const nationalHotlines = useMemo(
    () => VIETNAM_RANGER_STATIONS.filter((s) => s.region === 'Toàn Quốc'),
    []
  );

  const regionalStations = useMemo(() => {
    const q = normalizeSearch(searchQuery);
    return VIETNAM_RANGER_STATIONS.filter((station) => {
      if (station.region === 'Toàn Quốc') return false;
      if (selectedRegion !== 'Tất Cả' && station.region !== selectedRegion) return false;
      if (!q) return true;
      const haystack = normalizeSearch(
        [
          station.name,
          station.province,
          station.district,
          station.address,
          station.hotlinePhone,
          station.emergencyPhone,
          station.permitFeeNote,
          station.coveredTrailSlugs.join(' '),
        ].join(' ')
      );
      return haystack.includes(q);
    });
  }, [selectedRegion, searchQuery]);

  if (!isOpen && !isSafetyTimerOpen) return null;

  const handleCopyPhone = async (phone: string) => {
    const dialable = extractPrimaryDialPhone(phone);
    if (!dialable) return;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(dialable);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = dialable;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setCopiedPhone(dialable);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(
        () => setCopiedPhone((curr) => (curr === dialable ? null : curr)),
        1800
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: `Không thể sao chép tự động. Số cần gọi: ${dialable}`,
            type: 'info',
          },
        })
      );
    }
  };

  return (
    <>
      {isOpen &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-bg)',
              zIndex: 'var(--z-modal, 3000)' as unknown as number,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 14px',
              boxSizing: 'border-box',
              fontFamily: 'var(--font-family)',
            }}
          >
            <div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Danh bạ hotline cứu hộ và VQG Việt Nam"
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 680,
                width: '96%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 22,
                borderRadius: 6,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderTop: '3px solid var(--color-error)',
                boxShadow: 'var(--shadow-3d)',
                fontFamily: 'var(--font-family)',
                outline: 'none',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 12,
                  flexShrink: 0,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--color-error-text, var(--color-error))',
                      fontWeight: 700,
                      marginBottom: 3,
                    }}
                  >
                    Cứu hộ khẩn cấp &amp; Kiểm lâm cửa rừng 24/7
                  </div>
                  <h3
                    className="font-editorial"
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 600,
                      color: 'var(--color-text-main)',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <IconShieldAlert size={18} color="var(--color-error-text, var(--color-error))" />
                    Danh Bạ Hotline Cứu Hộ &amp; VQG Việt Nam
                  </h3>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  title="Đóng"
                  aria-label="Đóng"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                  }}
                >
                  <IconX size={16} />
                </button>
              </div>

              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-text-muted)',
                  marginTop: 0,
                  marginBottom: 12,
                  lineHeight: 1.5,
                  flexShrink: 0,
                }}
              >
                100% đầu số cứu nạn quốc gia, Ban Quản lý Vườn Quốc Gia, Khu Bảo Tồn Thiên Nhiên và Chi cục Kiểm lâm chính thức tại Việt Nam. Bấm trực tiếp để gọi hoặc sao chép số.
              </p>

              {/* Safety Timer & Offline 2G SOS CTA */}
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onClose();
                  setIsSafetyTimerOpen(true);
                }}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  marginBottom: 14,
                  padding: '10px 14px',
                  fontSize: '0.83rem',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                <IconClock size={15} color="var(--color-on-danger)" />
                <span>Mở Hẹn Giờ Báo Bình An &amp; Soạn Tin Nhắn SOS 2G</span>
              </button>

              {/* Pinned National 24/7 Emergency Quick-Dial Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))',
                  gap: 8,
                  marginBottom: 14,
                  flexShrink: 0,
                }}
              >
                {nationalHotlines.map((item) => {
                  const dial = extractPrimaryDialPhone(item.hotlinePhone);
                  const accent =
                    dial === '112' || dial === '113'
                      ? 'var(--color-error)'
                      : dial === '114'
                        ? 'var(--color-earth)'
                        : 'var(--color-primary)';
                  const shortLabel =
                    dial === '112'
                      ? 'Tìm kiếm cứu nạn'
                      : dial === '114'
                        ? 'PCCC & CNCH'
                        : dial === '115'
                          ? 'Cấp cứu y tế'
                          : 'Công an 113';

                  return (
                    <a
                      key={item.slug}
                      href={`tel:${dial}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '9px 11px',
                        borderRadius: 4,
                        background: `color-mix(in srgb, ${accent} 10%, var(--color-bg-main))`,
                        border: `1px solid color-mix(in srgb, ${accent} 38%, var(--color-border))`,
                        textDecoration: 'none',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '1.02rem',
                            fontWeight: 800,
                            color: accent === 'var(--color-error)' ? 'var(--color-error-text, var(--color-error))' : accent,
                            lineHeight: 1.1,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {dial}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {shortLabel}
                        </div>
                      </div>
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 4,
                          background: accent,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconPhone
                          size={13}
                          color={accent === 'var(--color-error)' ? 'var(--color-on-danger)' : 'var(--color-on-primary)'}
                        />
                      </span>
                    </a>
                  );
                })}
              </div>

              <div
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '7px 10px',
                  marginBottom: 12,
                  lineHeight: 1.45,
                  flexShrink: 0,
                }}
              >
                <strong style={{ color: 'var(--color-text-main)' }}>Lưu ý sóng yếu 2G:</strong> 112/114/115 chỉ gọi thoại — hãy gửi SMS tọa độ tới số di động người thân hoặc porter.
              </div>

              {/* Search & Region Filter Bar */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 12,
                  flexShrink: 0,
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 11,
                      display: 'inline-flex',
                      color: 'var(--color-text-dim)',
                      pointerEvents: 'none',
                    }}
                  >
                    <IconSearch size={14} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm VQG, kiểm lâm, tỉnh thành hoặc tên cung (VD: Fansipan, Cát Tiên, Bà Đen)..."
                    aria-label="Tìm kiếm trạm kiểm lâm và vườn quốc gia"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {REGION_FILTERS.map((region) => {
                      const active = selectedRegion === region;
                      return (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setSelectedRegion(region)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.74rem',
                            fontWeight: active ? 700 : 500,
                            borderRadius: 4,
                            cursor: 'pointer',
                            border: active
                              ? '1px solid var(--color-primary)'
                              : '1px solid var(--color-border)',
                            background: active
                              ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-main))'
                              : 'var(--color-bg-main)',
                            color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            fontFamily: 'var(--font-family)',
                          }}
                        >
                          {region}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                    {regionalStations.length} đầu mối đã xác minh
                  </span>
                </div>
              </div>

              {/* Scrollable Verified Stations Directory */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingRight: 2,
                  marginBottom: 14,
                }}
              >
                {regionalStations.length === 0 ? (
                  <div
                    style={{
                      padding: '24px 16px',
                      textAlign: 'center',
                      borderRadius: 4,
                      border: '1px dashed var(--color-border)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.82rem',
                    }}
                  >
                    Không tìm thấy đầu mối kiểm lâm / VQG khớp với từ khóa. Trong tình huống khẩn cấp hãy bấm gọi ngay <strong>112</strong> hoặc <strong>114</strong> phía trên.
                  </div>
                ) : (
                  regionalStations.map((station) => {
                    const primaryDial = extractPrimaryDialPhone(station.hotlinePhone);
                    const secondaryDial = extractPrimaryDialPhone(station.emergencyPhone);
                    const showSecondary =
                      Boolean(secondaryDial) &&
                      secondaryDial !== primaryDial &&
                      secondaryDial.length > 3;
                    const meta = getAuthorityMeta(station.authorityType);

                    return (
                      <div
                        key={station.slug}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderLeft: `3px solid ${meta.color}`,
                          padding: '11px 13px',
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 210 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  color: meta.textColor,
                                  background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                                  border: `1px solid color-mix(in srgb, ${meta.color} 32%, transparent)`,
                                }}
                              >
                                {station.authorityType === 'national_park' ? (
                                  <IconTrees size={11} color={meta.textColor} />
                                ) : (
                                  <IconShieldCheck size={11} color={meta.textColor} />
                                )}
                                {meta.label}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                                {station.province} • {station.region}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.35 }}>
                              {station.name}
                            </div>

                            <div
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--color-text-muted)',
                                marginTop: 3,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 5,
                                lineHeight: 1.45,
                              }}
                            >
                              <span style={{ marginTop: 2, flexShrink: 0 }}>
                                <IconMapPin size={12} color="var(--color-text-dim)" />
                              </span>
                              <span>{station.address}</span>
                            </div>

                            {station.permitFeeNote && (
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--color-text-dim)',
                                  marginTop: 4,
                                  lineHeight: 1.4,
                                }}
                              >
                                {station.permitFeeNote}
                              </div>
                            )}
                          </div>

                          {/* Clean Single-Number Call & Copy Controls */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <a
                                href={`tel:${primaryDial}`}
                                className="btn btn-primary"
                                style={{
                                  background: meta.color,
                                  borderColor: meta.color,
                                  color: meta.onColor,
                                  padding: '6px 11px',
                                  fontSize: '0.77rem',
                                  borderRadius: 4,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  fontVariantNumeric: 'tabular-nums',
                                  textDecoration: 'none',
                                }}
                              >
                                <IconPhone
                                  size={12}
                                  color={meta.onColor}
                                />
                                {station.hotlinePhone}
                              </a>

                              <button
                                type="button"
                                onClick={() => handleCopyPhone(station.hotlinePhone)}
                                title="Sao chép số điện thoại"
                                aria-label={`Sao chép số ${station.hotlinePhone}`}
                                style={{
                                  padding: '6px 7px',
                                  borderRadius: 4,
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-bg-card)',
                                  color: copiedPhone === primaryDial ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {copiedPhone === primaryDial ? <IconCheck size={13} /> : <IconCopy size={13} />}
                              </button>
                            </div>

                            {showSecondary && (
                              <a
                                href={`tel:${secondaryDial}`}
                                style={{
                                  padding: '4px 9px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  borderRadius: 4,
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-bg-card)',
                                  color: 'var(--color-sky)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <IconPhone size={11} color="var(--color-sky)" />
                                Hotline: {station.emergencyPhone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
                style={{ width: '100%', justifyContent: 'center', padding: '9px 0', borderRadius: 4, flexShrink: 0 }}
              >
                Đóng Danh Bạ
              </button>
            </div>
          </div>,
          document.body
        )}

      {isSafetyTimerOpen && (
        <Suspense
          fallback={
            createPortal(
              <div
                className="modal-overlay"
                role="status"
                aria-live="polite"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'var(--overlay-bg)',
                  zIndex: 'var(--z-modal, 3000)' as unknown as number,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  className="modal-content"
                  style={{
                    padding: '16px 22px',
                    borderRadius: 6,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-strong)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  Đang mở Hẹn giờ an toàn...
                </div>
              </div>,
              document.body
            )
          }
        >
          <SafetyTimerModal
            isOpen={isSafetyTimerOpen}
            onClose={() => setIsSafetyTimerOpen(false)}
            currentUser={currentUser}
            trails={trails}
            onShowToast={(message, type) => {
              window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
            }}
            onRequireAuth={() => {
              setIsSafetyTimerOpen(false);
              window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
            }}
          />
        </Suspense>
      )}
    </>
  );
};
