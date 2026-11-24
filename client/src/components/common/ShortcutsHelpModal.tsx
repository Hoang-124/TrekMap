import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { mockTrails } from '../../data/seedData.js';
import { VIETNAM_RANGER_STATIONS } from '../../data/vietnamDirectory.js';
import {
  IconCompass,
  IconHelpCircle,
  IconSearch,
  IconSparkles,
  IconX,
} from './SvgIcons.js';

export interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCommandPalette?: () => void;
}

interface ShortcutRow {
  keys: readonly string[];
  label: string;
  detail: string;
}

interface ShortcutGroup {
  title: string;
  accent: string;
  items: readonly ShortcutRow[];
}

const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Điều Hướng & Tìm Kiếm Toàn Hệ Thống',
    accent: 'var(--color-primary)',
    items: [
      {
        keys: ['Ctrl', 'K'],
        label: 'Mở Bảng Lệnh Nhanh (Command Palette)',
        detail: `Tìm nhanh ${mockTrails.length} cung đường DEM, 8 Hub công cụ, ${VIETNAM_RANGER_STATIONS.length} Trạm Kiểm Lâm hoặc hỏi LOST AI`,
      },
      {
        keys: ['/'],
        label: 'Tập trung ô tìm kiếm trên thanh điều hướng',
        detail: 'Nhảy thẳng vào thanh lọc cung đường mà không cần chạm chuột',
      },
      {
        keys: ['?'],
        label: 'Mở / Đóng Bảng Phím Tắt Hệ Thống',
        detail: 'Hiển thị nhanh danh sách toàn bộ phím tắt hiện hành trên LOST',
      },
      {
        keys: ['↑', '↓', 'Enter'],
        label: 'Di chuyển & mở mục trong Bảng Lệnh',
        detail: 'Hỗ trợ đầy đủ phím mũi tên trái/phải trong thanh Trung Tâm Thám Hiểm',
      },
    ],
  },
  {
    title: 'Tiện Ích Thực Địa & Tương Tác Nhanh',
    accent: 'var(--color-sky)',
    items: [
      {
        keys: ['Alt', 'A'],
        label: 'Bật / Tắt Trợ Lý Địa Hình LOST AI',
        detail: 'Mở nhanh bộ phân tích Go/No-Go, sơ cứu WFA, kiểm toán balo & ảnh hiện trường',
      },
      {
        keys: ['Alt', 'T'],
        label: 'Chuyển Giao Diện Tối / Sáng',
        detail: 'Chuyển đổi tức thì giữa Obsidian Slate (Tối) và Field Paper (Sáng)',
      },
      {
        keys: ['Ctrl', 'Enter'],
        label: 'Gửi nhanh bình luận / phản hồi Diễn Đàn',
        detail: 'Hoạt động trong mọi ô bình luận và phản hồi thảo luận cộng đồng',
      },
      {
        keys: ['Esc'],
        label: 'Đóng hộp thoại hoặc cửa sổ đang mở',
        detail: 'Đóng lớp modal trên cùng an toàn mà không ảnh hưởng các màn hình phía dưới',
      },
    ],
  },
];

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  onOpenCommandPalette,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: closeBtnRef });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        background: 'var(--overlay-bg)',
        padding: '20px 14px',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        data-lost-modal="shortcuts-help"
        aria-labelledby="lost-shortcuts-modal-title"
        className="modal-content modal-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 660,
          maxHeight: 'min(88vh, 720px)',
          overflowY: 'auto',
          padding: '20px 22px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          fontFamily: 'var(--font-family)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            paddingBottom: 12,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-main))',
                border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconHelpCircle size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                }}
              >
                LOST FIELD ATLAS · KEYBOARD NAVIGATION
              </div>
              <h2
                id="lost-shortcuts-modal-title"
                className="font-editorial"
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: 'var(--color-text-main)',
                }}
              >
                Bảng Phím Tắt Hệ Thống
              </h2>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng phím tắt"
            className="btn btn-outline"
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SHORTCUT_GROUPS.map((group) => (
            <section
              key={group.title}
              aria-label={group.title}
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: group.accent,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {group.accent === 'var(--color-primary)' ? (
                  <IconCompass size={13} color={group.accent} />
                ) : (
                  <IconSparkles size={13} color={group.accent} />
                )}
                <span>{group.title}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: 'var(--color-text-main)',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--color-text-muted)',
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.detail}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={`${item.label}-${k}`}>
                          <kbd
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 26,
                              height: 24,
                              padding: '0 7px',
                              borderRadius: 4,
                              background: 'var(--color-surface-elevated)',
                              border: '1px solid var(--color-border-strong)',
                              color: 'var(--color-text-main)',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-family)',
                              lineHeight: 1,
                            }}
                          >
                            {k}
                          </kbd>
                          {idx < item.keys.length - 1 && (
                            <span
                              aria-hidden="true"
                              style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 700 }}
                            >
                              +
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
            Phím tắt tự động tạm dừng khi bạn đang gõ chữ trong ô nhập liệu hoặc bộ gõ tiếng Việt.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onOpenCommandPalette && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  onClose();
                  onOpenCommandPalette();
                }}
                style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 6 }}
              >
                <IconSearch size={14} />
                Mở Bảng Lệnh (Ctrl+K)
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              Đã Hiểu
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
