import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '../common/SvgIcons.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';

interface FilterProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion: string;
  onSelectRegion: (r: string) => void;
  selectedDifficulty: number | null;
  onSelectDifficulty: (d: number | null) => void;
  selectedDuration: number | null;
  onSelectDuration: (d: number | null) => void;
  campsiteOnly: boolean;
  onToggleCampsite: (val: boolean) => void;
  kidFriendlyOnly: boolean;
  onToggleKidFriendly: (val: boolean) => void;
  sortBy?: string;
  onSelectSortBy?: (sort: string) => void;
  onReset: () => void;
}

export const AdvancedFilterDrawer: React.FC<FilterProps> = ({
  isOpen,
  onClose,
  selectedRegion,
  onSelectRegion,
  selectedDifficulty,
  onSelectDifficulty,
  selectedDuration,
  onSelectDuration,
  campsiteOnly,
  onToggleCampsite,
  kidFriendlyOnly,
  onToggleKidFriendly,
  sortBy = 'rating_desc',
  onSelectSortBy,
  onReset,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: closeBtnRef });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        zIndex: 'var(--z-drawer, 2000)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 14px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Bộ lọc và sắp xếp nâng cao"
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 6,
          padding: 22,
          boxShadow: 'var(--shadow-3d)',
          outline: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
            Bộ Lọc &amp; Sắp Xếp Nâng Cao
          </h3>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng bộ lọc"
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Sort Selector */}
        {onSelectSortBy && (
          <div style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
              Sắp Xếp Theo
            </label>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => onSelectSortBy(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--color-bg-main)',
                color: 'var(--color-text-main)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 4,
                padding: '9px 12px',
              }}
            >
              <option value="rating_desc">Đánh giá cao nhất (Mặc định)</option>
              <option value="distance_asc">Độ dài: Ngắn nhất - Dài nhất</option>
              <option value="distance_desc">Độ dài: Dài nhất - Ngắn nhất</option>
              <option value="difficulty_asc">Độ khó: Dễ - Thử thách</option>
              <option value="difficulty_desc">Độ khó: Thử thách - Dễ</option>
            </select>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
            Vùng Miền
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSelectRegion(r)}
                className={`btn ${selectedRegion === r ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  flex: '1 1 100px',
                  padding: '8px 6px',
                  fontSize: '0.82rem',
                  borderRadius: 4,
                  justifyContent: 'center',
                }}
              >
                {r === 'All' ? 'Tất cả' : r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
            Mức độ khó (Thang 1 - 5)
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDifficulty(selectedDifficulty === d ? null : d)}
                className={`btn ${selectedDifficulty === d ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  flex: '1 1 70px',
                  padding: '8px 6px',
                  fontSize: '0.82rem',
                  borderRadius: 4,
                  justifyContent: 'center',
                }}
              >
                Cấp {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
            Thời gian hành trình
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { val: 1, label: '1 Ngày' },
              { val: 2, label: '2N1Đ' },
              { val: 3, label: '3N2Đ+' },
            ].map((dur) => (
              <button
                key={dur.val}
                type="button"
                onClick={() => onSelectDuration(selectedDuration === dur.val ? null : dur.val)}
                className={`btn ${selectedDuration === dur.val ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  flex: '1 1 90px',
                  padding: '8px 6px',
                  fontSize: '0.82rem',
                  borderRadius: 4,
                  justifyContent: 'center',
                }}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={campsiteOnly}
              onChange={(e) => onToggleCampsite(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: 'var(--color-primary)' }}
            />
            Có bãi cắm trại qua đêm
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={kidFriendlyOnly}
              onChange={(e) => onToggleKidFriendly(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: 'var(--color-primary)' }}
            />
            Phù hợp người mới &amp; trẻ em
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onReset}
            style={{ flex: 1, justifyContent: 'center', borderRadius: 4 }}
          >
            Xóa bộ lọc
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ flex: 2, justifyContent: 'center', borderRadius: 4 }}
          >
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
