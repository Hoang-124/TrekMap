import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconUsers, IconX } from '../common/SvgIcons.js';
import { mockTrails } from '../../data/seedData.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import type { Trail } from '../../types.js';

export interface TripBudgetDraft {
  trailId?: string;
  budgetNote?: string;
}

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDraft?: TripBudgetDraft | null;
}

type TrailWithMongoId = Trail & { _id?: string };

function parseDraftBudgetFields(
  draft: TripBudgetDraft,
  trailsList: Trail[]
): {
  trailId: string;
  trailName: string;
  difficultyLevel: number;
  title: string;
  estimatedCost: string;
  maxMembers: number;
  description: string;
} {
  const note = String(draft.budgetNote || '').trim();
  const matched = draft.trailId
    ? trailsList.find((t) => t.id === draft.trailId || (t as TrailWithMongoId)._id === draft.trailId)
    : undefined;

  const perPersonMatch = note.match(/BINH QUAN MOI NGUOI:\s*([^\n\r]+)/i);
  const totalMatch = note.match(/TONG CA DOAN:\s*([^\n\r]+)/i);
  const groupMatch = note.match(/Quy mo:\s*(\d+)/i);

  const parsedCost = perPersonMatch
    ? `${perPersonMatch[1].trim()} / người`
    : totalMatch
      ? `Tổng đoàn ${totalMatch[1].trim()}`
      : 'Chia đều chi phí thực tế';

  const parsedMembers = groupMatch
    ? Math.max(2, Math.min(30, Number(groupMatch[1]) || 6))
    : 6;

  return {
    trailId: matched ? (matched.id || (matched as TrailWithMongoId)._id || '') : '',
    trailName: matched?.name || '',
    difficultyLevel: matched?.difficultyLevel || 3,
    title: matched ? `Ghép đoàn chinh phục ${matched.name}` : 'Chuyến trekking ghép đoàn mới',
    estimatedCost: parsedCost,
    maxMembers: parsedMembers,
    description: note,
  };
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDraft,
}) => {
  const [trails, setTrails] = useState<Trail[]>(mockTrails);
  const [hasLoadedTrails, setHasLoadedTrails] = useState(false);

  const [title, setTitle] = useState('');
  const [selectedTrailId, setSelectedTrailId] = useState('');
  const [customTrailName, setCustomTrailName] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState(3);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [meetingPoint, setMeetingPoint] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('Chia đều chi phí thực tế');
  const [requirements, setRequirements] = useState('');
  const [tagsInput, setTagsInput] = useState('Trekking, Ghép Đoàn');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const submitAbortRef = useRef<AbortController | null>(null);
  const trailsRef = useRef<Trail[]>(trails);
  const hydratedDraftRef = useRef<TripBudgetDraft | string | null>(null);

  useEffect(() => {
    trailsRef.current = trails;
  }, [trails]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      submitAbortRef.current?.abort();
    };
  }, []);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: titleInputRef });

  // Hydrate form from Cost Estimator -> Trip Budget handoff ONCE per open session/draft (prop or sessionStorage fallback)
  useEffect(() => {
    if (!isOpen) {
      hydratedDraftRef.current = null;
      return;
    }

    let resolvedDraft: TripBudgetDraft | null = initialDraft || null;
    let draftKey: TripBudgetDraft | string | null = initialDraft || null;

    if (!resolvedDraft) {
      try {
        const raw = sessionStorage.getItem('lost_trip_budget_draft');
        if (raw) {
          const parsed = JSON.parse(raw) as { trailId?: string; budgetNote?: string; ts?: number };
          sessionStorage.removeItem('lost_trip_budget_draft');
          const isFresh = !parsed.ts || Date.now() - Number(parsed.ts) < 10 * 60 * 1000;
          if (isFresh && (parsed.trailId || parsed.budgetNote)) {
            resolvedDraft = { trailId: parsed.trailId, budgetNote: parsed.budgetNote };
            draftKey = raw;
          }
        }
      } catch {
        // ignore storage errors
      }
    }

    if (!resolvedDraft || hydratedDraftRef.current === draftKey) return;
    hydratedDraftRef.current = draftKey;
    const draftToApply = resolvedDraft;
    const rafId = window.requestAnimationFrame(() => {
      const parsed = parseDraftBudgetFields(draftToApply, trailsRef.current);
      setSelectedTrailId(parsed.trailId);
      setCustomTrailName(parsed.trailName);
      setDifficultyLevel(parsed.difficultyLevel);
      setTitle(parsed.title);
      setEstimatedCost(parsed.estimatedCost);
      setMaxMembers(parsed.maxMembers);
      setDescription(parsed.description);
      setError('');
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, initialDraft]);

  const resetForm = useCallback(() => {
    setTitle('');
    setSelectedTrailId('');
    setCustomTrailName('');
    setDifficultyLevel(3);
    setDescription('');
    setStartDate('');
    setEndDate('');
    setMaxMembers(6);
    setMeetingPoint('');
    setEstimatedCost('Chia đều chi phí thực tế');
    setRequirements('');
    setTagsInput('Trekking, Ghép Đoàn');
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    if (loadingRef.current) return;
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // Fetch real trails list only when opened
  useEffect(() => {
    if (!isOpen || hasLoadedTrails) return;
    let active = true;
    fetch('/api/trails')
      .then((res) => res.json())
      .then((json) => {
        if (active && json?.success && Array.isArray(json.data) && json.data.length > 0) {
          setTrails(json.data);
          setHasLoadedTrails(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, hasLoadedTrails]);

  // Escape key close (strict LIFO via topmost focus trap + IME guard)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (loadingRef.current) return;
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val && endDate < val) {
      setEndDate(val);
    }
    if (error) setError('');
  };

  const handleTrailSelect = (val: string) => {
    setSelectedTrailId(val);
    const chosen = trails.find((t) => (t.id || (t as TrailWithMongoId)._id) === val);
    if (chosen) {
      setCustomTrailName(chosen.name);
      if (chosen.difficultyLevel) {
        setDifficultyLevel(chosen.difficultyLevel);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingRef.current) return;
    setError('');

    const token = localStorage.getItem('lost_token');
    if (!token) {
      setError('Bạn cần đăng nhập để tạo chuyến đi ghép đoàn.');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    if (!startDate || !endDate) {
      setError('Vui lòng chọn đầy đủ ngày khởi hành và ngày kết thúc.');
      return;
    }

    if (endDate < startDate) {
      setError('Ngày kết thúc phải lớn hơn hoặc bằng ngày khởi hành.');
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;

    try {
      const chosen = selectedTrailId
        ? trails.find((t) => (t.id || (t as TrailWithMongoId)._id) === selectedTrailId)
        : null;
      const resolvedTrailId = chosen ? ((chosen as TrailWithMongoId)._id || chosen.id) : undefined;
      const resolvedTrailName = chosen ? chosen.name : customTrailName.trim();

      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        signal: controller.signal,
        body: JSON.stringify({
          title: title.trim(),
          trailId: resolvedTrailId,
          trailName: resolvedTrailName,
          difficultyLevel,
          description: description.trim(),
          requirements: requirements.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : ['Trekking', 'Ghép Đoàn'],
          startDate,
          endDate,
          maxMembers,
          meetingPoint: meetingPoint.trim(),
          estimatedCost: estimatedCost.trim(),
        }),
      });

      const data = await res.json();
      if (controller.signal.aborted || !isMountedRef.current) return;

      if (res.ok && data.success) {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: {
              message: data.message || 'Mở chuyến ghép đoàn thành công! Bạn là trưởng đoàn.',
              type: 'success',
            },
          })
        );
        loadingRef.current = false;
        setLoading(false);
        resetForm();
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Không thể mở chuyến ghép đoàn.');
      }
    } catch {
      if (controller.signal.aborted || !isMountedRef.current) return;
      setError('Lỗi kết nối máy chủ khi tạo chuyến.');
    } finally {
      loadingRef.current = false;
      if (!controller.signal.aborted && isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--color-bg-main)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    fontSize: '0.84rem',
    color: 'var(--color-text-main)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        zIndex: 'var(--z-modal, 3000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Mở chuyến ghép đoàn mới"
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600,
          width: '94%',
          padding: 0,
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 4,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconUsers size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Kế hoạch đồng hành
              </div>
              <h3 className="font-editorial" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                Mở Chuyến Ghép Đoàn Mới
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleClose}
            title="Đóng (Esc)"
            aria-label="Đóng"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              padding: 6,
              borderRadius: 4,
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '78vh', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--banner-danger-bg)',
                border: '1px solid var(--banner-danger-border)',
                color: 'var(--banner-danger-text)',
                fontSize: '0.8rem',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label style={labelStyle}>Tên chuyến đi / Tiêu đề hành trình *</label>
            <input
              ref={titleInputRef}
              type="text"
              required
              placeholder="VD: Chinh phục Tà Xùa cuối tuần săn mây T11"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Chọn cung đường thực tế</label>
              <select
                value={selectedTrailId}
                onChange={(e) => handleTrailSelect(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Tự nhập tên cung bên cạnh --</option>
                {trails.map((t) => {
                  const tid = t.id || (t as Trail & { _id?: string })._id || '';
                  return (
                    <option key={tid} value={tid}>
                      {t.name} ({t.province})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tên cung mục tiêu</label>
              <input
                type="text"
                placeholder="VD: Fansipan, Tà Xùa, Lảo Thẩn..."
                value={customTrailName}
                onChange={(e) => {
                  setCustomTrailName(e.target.value);
                  if (selectedTrailId) setSelectedTrailId('');
                }}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Ngày khởi hành *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Ngày kết thúc *</label>
              <input
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (error) setError('');
                }}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Số thành viên tối đa *</label>
              <input
                type="number"
                min={2}
                max={25}
                required
                value={maxMembers}
                onChange={(e) => setMaxMembers(Math.max(2, Math.min(25, Number(e.target.value) || 2)))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Độ khó dự kiến (1-5)</label>
              <select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(Number(e.target.value))}
                style={inputStyle}
              >
                <option value={1}>Cấp 1 — Nhẹ nhàng</option>
                <option value={2}>Cấp 2 — Dễ</option>
                <option value={3}>Cấp 3 — Trung bình</option>
                <option value={4}>Cấp 4 — Thử thách</option>
                <option value={5}>Cấp 5 — Khắc nghiệt</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Điểm hẹn tập trung</label>
            <input
              type="text"
              placeholder="VD: Bến xe Mỹ Đình, Hà Nội hoặc Quảng trường Sa Pa"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Dự kiến chi phí đóng góp</label>
            <input
              type="text"
              placeholder="VD: Khoảng 1.800.000 VNĐ / người (Xe khứ hồi + Porter + Ăn)"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Mô tả kế hoạch &amp; Lộ trình</label>
            <textarea
              rows={3}
              placeholder="Chi tiết lộ trình di chuyển, lịch nghỉ trại, phương tiện..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Yêu cầu thể lực &amp; Chuẩn bị</label>
              <input
                type="text"
                placeholder="VD: Đã từng đi ít nhất 1 cung >2.000m, tự túc giày bám đá"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                maxLength={500}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Thẻ gắn (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="VD: Trekking, Săn Mây, Cuối Tuần"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                maxLength={200}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              disabled={loading}
              onClick={handleClose}
              className="btn btn-outline"
              style={{ borderRadius: 4, padding: '8px 18px', fontSize: '0.84rem', fontWeight: 700 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ borderRadius: 4, padding: '8px 22px', fontSize: '0.84rem', fontWeight: 800 }}
            >
              {loading ? 'Đang tạo chuyến...' : 'Đăng Mở Chuyến'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
