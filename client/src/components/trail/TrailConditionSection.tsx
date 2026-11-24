import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { deleteTrailCondition } from '../../services/api.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import {
  IconAlertTriangle,
  IconShieldCheck,
  IconPlus,
  IconCheckCircle,
  IconClock,
  IconMapPin,
  IconCloudFog,
  IconShieldAlert,
  IconX,
  IconTrash,
} from '../common/SvgIcons.js';

export interface ConditionItem {
  _id: string;
  userId: {
    _id?: string;
    id?: string;
    fullName: string;
    avatarUrl: string;
    reputationScore?: number;
  };
  condition: 'safe' | 'caution' | 'dangerous' | 'closed';
  description: string;
  section: string;
  weatherNote?: string;
  upvotes: number;
  hasUpvoted?: boolean;
  createdAt: string;
}

interface TrailConditionSectionProps {
  trailId: string;
  currentUser?: { id?: string; _id?: string; role?: string } | null;
}

function resolveViewerFromToken(): { id: string; role: string } | null {
  try {
    const token = localStorage.getItem('lost_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64));
    return {
      id: String(json?.userId || json?.id || json?._id || ''),
      role: String(json?.role || 'user'),
    };
  } catch {
    return null;
  }
}

const SECTION_PRESETS = [
  'Toàn tuyến',
  'Chân núi → Lán nghỉ',
  'Đoạn vượt suối / Cầu gỗ',
  'Sống núi → Đỉnh',
  'Khu vực hạ trại / Nguồn nước',
];

export const TrailConditionSection: React.FC<TrailConditionSectionProps> = ({ trailId, currentUser }) => {
  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'caution' | 'dangerous' | 'closed'>('all');
  const [condition, setCondition] = useState<'safe' | 'caution' | 'dangerous' | 'closed'>('safe');
  const [section, setSection] = useState('Toàn tuyến');
  const [weatherNote, setWeatherNote] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const viewerIdentity = useMemo(() => {
    if (currentUser && (currentUser.id || currentUser._id || currentUser.role)) {
      return {
        id: String(currentUser.id || currentUser._id || ''),
        role: String(currentUser.role || 'user'),
      };
    }
    return resolveViewerFromToken();
  }, [currentUser]);

  // Close submission form or inline delete confirm with Escape key (only when no modal sits above)
  useEffect(() => {
    if (!isFormOpen && !confirmDeleteId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (document.querySelector('[aria-modal="true"]')) return;
        if (confirmDeleteId) setConfirmDeleteId(null);
        else if (isFormOpen) setIsFormOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, confirmDeleteId]);

  const fetchConditions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/trail-conditions/trail/${encodeURIComponent(trailId)}`, {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setConditions(data.data);
        const upvotedMap: Record<string, boolean> = {};
        for (const item of data.data as ConditionItem[]) {
          if (item.hasUpvoted) upvotedMap[item._id] = true;
        }
        setUpvotedIds(upvotedMap);
      } else {
        setConditions([]);
      }
    } catch {
      setConditions([]);
    } finally {
      setIsLoading(false);
    }
  }, [trailId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/trail-conditions/trail/${encodeURIComponent(trailId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.success && Array.isArray(data.data)) {
          setConditions(data.data);
          const upvotedMap: Record<string, boolean> = {};
          for (const item of data.data as ConditionItem[]) {
            if (item.hasUpvoted) upvotedMap[item._id] = true;
          }
          setUpvotedIds(upvotedMap);
        } else {
          setConditions([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setConditions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [trailId]);

  const handleDeleteCondition = async (conditionId: string) => {
    if (!conditionId || deletingId) return;
    setDeletingId(conditionId);
    setFeedback(null);
    try {
      const res = await deleteTrailCondition(conditionId);
      setConfirmDeleteId(null);
      setConditions((prev) => prev.filter((item) => item._id !== conditionId));
      setFeedback({ text: res.message || 'Đã xóa báo cáo tình trạng đường.', type: 'success' });
      await fetchConditions();
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Không thể xóa báo cáo tình trạng đường lúc này.',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFeedback(null);

    const token = localStorage.getItem('lost_token');
    if (!token) {
      setFeedback({ text: 'Vui lòng đăng nhập tài khoản để gửi báo cáo tình trạng thực địa.', type: 'error' });
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/trail-conditions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trailId,
          condition,
          section,
          weatherNote,
          description,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ text: data.message || 'Cập nhật tình trạng đường thực địa thành công (+10 điểm uy tín)!', type: 'success' });
        setIsFormOpen(false);
        setDescription('');
        setWeatherNote('');
        await fetchConditions();
      } else {
        setFeedback({ text: data.message || 'Không thể gửi báo cáo.', type: 'error' });
      }
    } catch {
      setFeedback({ text: 'Lỗi kết nối máy chủ khi gửi báo cáo.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    const token = localStorage.getItem('lost_token');
    if (!token) {
      setFeedback({ text: 'Vui lòng đăng nhập để xác nhận báo cáo thực địa này.', type: 'error' });
      return;
    }
    if (upvotedIds[id]) return;

    try {
      const res = await fetch(`/api/trail-conditions/${encodeURIComponent(id)}/upvote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUpvotedIds((prev) => ({ ...prev, [id]: true }));
        setConditions((prev) =>
          prev.map((c) => (c._id === id ? { ...c, upvotes: data.upvotes } : c))
        );
      } else if (data.message) {
        setFeedback({ text: data.message, type: 'error' });
      }
    } catch {
      // Ignore network hiccup
    }
  };

  const getConditionMeta = (type: string) => {
    switch (type) {
      case 'none':
        return {
          label: 'CHƯA CÓ BÁO CÁO THỰC ĐỊA GẦN ĐÂY',
          shortLabel: 'Chưa có dữ liệu',
          badgeClass: 'badge badge-info',
          accentColor: 'var(--color-text-muted)',
          bgTint: 'var(--color-surface-elevated)',
          borderTint: 'var(--color-border-strong)',
          isEmpty: true,
        };
      case 'safe':
        return {
          label: 'AN TOÀN • ĐƯỜNG KHÔ RÁO',
          shortLabel: 'An toàn',
          badgeClass: 'badge badge-success',
          accentColor: 'var(--color-primary)',
          bgTint: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          borderTint: 'color-mix(in srgb, var(--color-primary) 35%, transparent)',
          isEmpty: false,
        };
      case 'caution':
        return {
          label: 'THẬN TRỌNG • TRƠN TRƯỢT / SƯƠNG MÙ',
          shortLabel: 'Thận trọng',
          badgeClass: 'badge badge-sun',
          accentColor: 'var(--color-sun)',
          bgTint: 'color-mix(in srgb, var(--color-sun) 12%, transparent)',
          borderTint: 'color-mix(in srgb, var(--color-sun) 35%, transparent)',
          isEmpty: false,
        };
      case 'dangerous':
        return {
          label: 'NGUY HIỂM • SẠT LỞ / LŨ SUỐI',
          shortLabel: 'Nguy hiểm',
          badgeClass: 'badge badge-error',
          accentColor: 'var(--color-error)',
          bgTint: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
          borderTint: 'color-mix(in srgb, var(--color-error) 38%, transparent)',
          isEmpty: false,
        };
      case 'closed':
        return {
          label: 'TẠM ĐÓNG TUYẾN • KIỂM LÂM PHONG TỎA',
          shortLabel: 'Tạm đóng',
          badgeClass: 'badge badge-warning',
          accentColor: 'var(--color-earth)',
          bgTint: 'color-mix(in srgb, var(--color-earth) 14%, transparent)',
          borderTint: 'color-mix(in srgb, var(--color-earth) 38%, transparent)',
          isEmpty: false,
        };
      default:
        return {
          label: type,
          shortLabel: type,
          badgeClass: 'badge badge-info',
          accentColor: 'var(--color-sky)',
          bgTint: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
          borderTint: 'color-mix(in srgb, var(--color-sky) 30%, transparent)',
          isEmpty: false,
        };
    }
  };

  const filteredConditions = useMemo(() => {
    if (activeFilter === 'all') return conditions;
    return conditions.filter((c) => c.condition === activeFilter);
  }, [conditions, activeFilter]);

  const summaryStatus = useMemo(() => {
    if (conditions.length === 0) return getConditionMeta('none');
    if (conditions.some((c) => c.condition === 'closed')) return getConditionMeta('closed');
    if (conditions.some((c) => c.condition === 'dangerous')) return getConditionMeta('dangerous');
    if (conditions.some((c) => c.condition === 'caution')) return getConditionMeta('caution');
    return getConditionMeta('safe');
  }, [conditions]);

  return (
    <div
      className="card"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: 24,
      }}
    >
      {/* Top Command Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 18,
          marginBottom: 18,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 6,
              background: summaryStatus.bgTint,
              border: `1px solid ${summaryStatus.borderTint}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: summaryStatus.accentColor,
              flexShrink: 0,
            }}
          >
            {summaryStatus.isEmpty ? (
              <IconClock size={21} color={summaryStatus.accentColor} />
            ) : (
              <IconShieldCheck size={21} color={summaryStatus.accentColor} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                Trạng Thái Đường Thực Địa 7 Ngày Qua
              </h3>
              <span className={summaryStatus.badgeClass} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStatus.label}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              {summaryStatus.isEmpty
                ? 'Chưa có dữ liệu quan trắc gần đây — hãy kiểm tra thời tiết Open-Meteo và hỏi Trạm Kiểm Lâm trước khi xuất phát.'
                : 'Báo cáo trực tiếp từ Trekker, Porter bản địa & Trạm Kiểm Lâm (Tự động làm mới sau 7 ngày)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen((prev) => !prev)}
          className={`btn ${isFormOpen ? 'btn-outline' : 'btn-primary'} interactive-click`}
          style={{
            borderRadius: 4,
            padding: '9px 16px',
            fontSize: '0.82rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isFormOpen ? <IconX size={15} /> : <IconPlus size={16} />}
          <span>{isFormOpen ? 'Đóng Biểu Mẫu (Esc)' : 'Báo Cáo Tình Trạng Mới'}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `Tất cả (${conditions.length})` },
              { id: 'safe', label: 'An toàn' },
              { id: 'caution', label: 'Thận trọng' },
              { id: 'dangerous', label: 'Nguy hiểm' },
              { id: 'closed', label: 'Tạm đóng' },
            ] as const
          ).map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className="interactive-click"
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--color-bg-main)',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
          Thưởng <strong style={{ color: 'var(--color-primary)' }}>+10 Điểm Uy Tín</strong> cho mỗi báo cáo chuẩn xác
        </span>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 4,
            background:
              feedback.type === 'success'
                ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                : 'color-mix(in srgb, var(--color-error) 12%, transparent)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'color-mix(in srgb, var(--color-primary) 35%, transparent)'
                : 'color-mix(in srgb, var(--color-error) 35%, transparent)'
            }`,
            color: feedback.type === 'success' ? 'var(--color-primary)' : 'var(--color-error-text, var(--color-error))',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <IconCheckCircle size={16} /> : <IconAlertTriangle size={16} />}
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Đóng thông báo"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* Collapsible Field Condition Submission Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="tab-content-slide"
          style={{
            marginBottom: 22,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border-glow)',
            borderRadius: 6,
            padding: 20,
          }}
        >
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShieldAlert size={18} color="var(--color-primary)" />
            <span>Gửi Báo Cáo Quan Sát Thực Địa Mới</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Mức độ an toàn hiện tại
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as 'safe' | 'caution' | 'dangerous' | 'closed')}
                className="form-select"
                style={{ width: '100%' }}
              >
                <option value="safe">An toàn • Đường khô ráo, dễ đi</option>
                <option value="caution">Thận trọng • Trơn trượt, cây đổ, sương mù</option>
                <option value="dangerous">Nguy hiểm • Sạt lở, lũ suối dâng cao</option>
                <option value="closed">Tạm đóng • Kiểm lâm cấm tuyến</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Phân đoạn ghi nhận
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="VD: Trạm Tôn → Lán 2.800m, Đỉnh..."
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Ghi chú thời tiết / Nhiệt độ (Tùy chọn)
              </label>
              <input
                type="text"
                value={weatherNote}
                onChange={(e) => setWeatherNote(e.target.value)}
                placeholder="VD: 12°C, sương mù nhẹ, gió cấp 3"
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Quick Section Preset Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Chọn nhanh đoạn:</span>
            {SECTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSection(preset)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: section === preset ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: section === preset ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--color-bg-card)',
                  color: section === preset ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
              Chi tiết quan sát thực địa (Mặt đường, nguồn nước, cầu cống, lán nghỉ...)
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cụ thể tình trạng mặt đường, mức nước suối, lán nghỉ để các đoàn đi sau chuẩn bị trang bị phù hợp..."
              className="form-textarea"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', borderRadius: 4 }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ padding: '8px 22px', borderRadius: 4, fontWeight: 800, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Đang gửi báo cáo...' : 'Đăng Báo Cáo Thực Địa'}
            </button>
          </div>
        </form>
      )}

      {/* Conditions List */}
      {isLoading ? (
        <div style={{ padding: 36, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
          Đang đồng bộ dữ liệu quan trắc mặt đường...
        </div>
      ) : filteredConditions.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: 'var(--color-bg-main)',
            borderRadius: 6,
            border: '1px dashed var(--color-border-strong)',
            color: 'var(--color-text-muted)',
            fontSize: '0.86rem',
          }}
        >
          Chưa có báo cáo thực địa gần đây trong phân mục này. Nếu bạn vừa hoàn thành cung đường, hãy cập nhật tình trạng mặt đường giúp cộng đồng!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredConditions.map((c) => {
            const meta = getConditionMeta(c.condition);
            const isUpvoted = !!upvotedIds[c._id];
            return (
              <div
                key={c._id}
                className="card-hover-lift"
                style={{
                  padding: '16px 18px',
                  background: 'var(--color-bg-main)',
                  border: `1px solid ${meta.borderTint}`,
                  borderLeft: `3px solid ${meta.accentColor}`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span className={meta.badgeClass} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                      {meta.label}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        background: 'var(--color-bg-card)',
                        padding: '3px 9px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <IconMapPin size={12} color="var(--color-sky)" />
                      {c.section || 'Toàn tuyến'}
                    </span>
                    {c.weatherNote && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-sky)',
                          background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
                          padding: '3px 9px',
                          borderRadius: 4,
                          border: '1px solid color-mix(in srgb, var(--color-sky) 28%, transparent)',
                        }}
                      >
                        <IconCloudFog size={12} color="var(--color-sky)" />
                        {c.weatherNote}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: '0.88rem',
                      color: 'var(--color-text-main)',
                      lineHeight: 1.55,
                      margin: '0 0 10px 0',
                    }}
                  >
                    {c.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: '0.74rem',
                      color: 'var(--color-text-dim)',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Ghi nhận bởi: <strong style={{ color: 'var(--color-text-main)' }}>{c.userId?.fullName || 'Trekker Thực Địa'}</strong>
                    </span>
                    {c.userId?.reputationScore && (
                      <span style={{ color: 'var(--color-sun)', fontWeight: 700 }}>
                        · {c.userId.reputationScore} Điểm Uy Tín
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconClock size={11} color="var(--color-text-dim)" />
                      {new Date(c.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleUpvote(c._id)}
                    className="interactive-click"
                    title="Xác nhận thông tin thực địa này là chính xác"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 4,
                      border: isUpvoted ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: isUpvoted ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg-card)',
                      color: isUpvoted ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: isUpvoted ? 'default' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <IconShieldCheck size={15} color={isUpvoted ? 'var(--color-primary)' : 'currentColor'} />
                    <span>Xác thực ({c.upvotes || 0})</span>
                  </button>

                  {(() => {
                    const authorId =
                      c.userId && typeof c.userId === 'object'
                        ? String(c.userId._id || c.userId.id || '')
                        : String(c.userId || '');
                    const isPrivileged = viewerIdentity?.role === 'admin' || viewerIdentity?.role === 'moderator';
                    const isOwner = Boolean(viewerIdentity?.id && authorId && viewerIdentity.id === authorId);
                    const canDelete = Boolean(viewerIdentity && (isOwner || isPrivileged));
                    if (!canDelete) return null;

                    const isConfirming = confirmDeleteId === c._id;
                    const isDeleting = deletingId === c._id;

                    if (isConfirming) {
                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))' }}>
                            Xóa?
                          </span>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteCondition(c._id)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              background: 'var(--color-error)',
                              color: 'var(--color-on-danger)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isDeleting ? 'wait' : 'pointer',
                              opacity: isDeleting ? 0.7 : 1,
                            }}
                          >
                            {isDeleting ? 'Đang xóa...' : 'Xác nhận'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--color-border-strong)',
                              background: 'var(--color-bg-card)',
                              color: 'var(--color-text-muted)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c._id)}
                        title="Xóa báo cáo tình trạng này"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '7px 10px',
                          borderRadius: 4,
                          border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
                          background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                          color: 'var(--color-error-text, var(--color-error))',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <IconTrash size={13} color="var(--color-error)" />
                        <span>Xóa</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
