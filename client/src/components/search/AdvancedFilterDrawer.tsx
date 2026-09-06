import React from 'react';
import { createPortal } from 'react-dom';

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
  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(3, 8, 14, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 800 }}>Bộ Lọc & Sắp Xếp Nâng Cao</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer' }}>
            Đóng
          </button>
        </div>

        {/* Sort Selector */}
        {onSelectSortBy && (
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>Sắp Xếp Theo</label>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => onSelectSortBy(e.target.value)}
              style={{ width: '100%', background: 'var(--color-bg-main)', color: 'var(--color-text-main)', borderColor: 'var(--color-border)', borderRadius: 10, padding: '10px 14px' }}
            >
              <option value="rating_desc">Đánh giá cao nhất (Default)</option>
              <option value="distance_asc">Độ dài: Ngắn nhất - Dài nhất</option>
              <option value="distance_desc">Độ dài: Dài nhất - Ngắn nhất</option>
              <option value="difficulty_asc">Độ khó: Dễ - Thử thách</option>
              <option value="difficulty_desc">Độ khó: Thử thách - Dễ</option>
            </select>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ marginBottom: 8 }}>Vùng Miền</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'].map((r) => (
              <button
                key={r}
                onClick={() => onSelectRegion(r)}
                className={`btn ${selectedRegion === r ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '0.82rem', justifyContent: 'center' }}
              >
                {r === 'All' ? 'Tất cả' : r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ marginBottom: 8 }}>Mức độ khó (Thang 1 - 5)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => onSelectDifficulty(selectedDifficulty === d ? null : d)}
                className={`btn ${selectedDifficulty === d ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '0.85rem', justifyContent: 'center' }}
              >
                Cấp {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ marginBottom: 8 }}>Thời gian hành trình</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: 1, label: '1 Ngày' },
              { val: 2, label: '2N1Đ' },
              { val: 3, label: '3N2Đ+' },
            ].map((dur) => (
              <button
                key={dur.val}
                onClick={() => onSelectDuration(selectedDuration === dur.val ? null : dur.val)}
                className={`btn ${selectedDuration === dur.val ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '0.85rem', justifyContent: 'center' }}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={campsiteOnly}
              onChange={(e) => onToggleCampsite(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
            />
            Có bãi cắm trại qua đêm
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={kidFriendlyOnly}
              onChange={(e) => onToggleKidFriendly(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
            />
            Phù hợp người mới & trẻ em
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onReset} style={{ flex: 1, justifyContent: 'center' }}>
            Xóa bộ lọc
          </button>
          <button className="btn btn-primary" onClick={onClose} style={{ flex: 2, justifyContent: 'center' }}>
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
