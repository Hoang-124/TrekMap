import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { deleteTrailCondition, uploadImageToCloudinary } from '../../services/api.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { decodeAccessTokenPayload, safeLocalStorageGet } from '../../utils/storageScope.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
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
  IconEdit,
  IconCamera,
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
  photos?: string[];
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
    const json = decodeAccessTokenPayload(token);
    if (!json) return null;
    return {
      id: String(json.userId || json.id || json._id || ''),
      role: String(json.role || 'user'),
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

export const TrailConditionSection: React.FC<TrailConditionSectionProps> = React.memo(({ trailId, currentUser }) => {
  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'caution' | 'dangerous' | 'closed'>('all');
  const [condition, setCondition] = useState<'safe' | 'caution' | 'dangerous' | 'closed'>('safe');
  const [section, setSection] = useState('Toàn tuyến');
  const [weatherNote, setWeatherNote] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline Edit Condition state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCondition, setEditCondition] = useState<'safe' | 'caution' | 'dangerous' | 'closed'>('safe');
  const [editSection, setEditSection] = useState('Toàn tuyến');
  const [editWeatherNote, setEditWeatherNote] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  // Condition photo lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [trackedTrailId, setTrackedTrailId] = useState<string>(trailId);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(Boolean(lightboxPhoto), lightboxRef);

  // Immediately clear stale state when switching trails
  if (trackedTrailId !== trailId) {
    setTrackedTrailId(trailId);
    setConditions([]);
    setIsLoading(true);
    setIsFormOpen(false);
    setEditingId(null);
    setConfirmDeleteId(null);
    setActiveFilter('all');
    setFeedback(null);
    setUpvotedIds({});
  }

  const viewerIdentity = useMemo(() => {
    if (currentUser && (currentUser.id || currentUser._id || currentUser.role)) {
      return {
        id: String(currentUser.id || currentUser._id || ''),
        role: String(currentUser.role || 'user'),
      };
    }
    return resolveViewerFromToken();
  }, [currentUser]);
  const viewerId = viewerIdentity?.id || '';

  // Close lightbox, submission form, inline edit or inline delete confirm with Escape key
  useEffect(() => {
    if (!isFormOpen && !confirmDeleteId && !editingId && !lightboxPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (lightboxPhoto) {
          if (!isTopmostFocusTrap(lightboxRef.current)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          setLightboxPhoto(null);
          return;
        }
        if (document.querySelector('[aria-modal="true"]')) return;
        if (confirmDeleteId) setConfirmDeleteId(null);
        else if (editingId) setEditingId(null);
        else if (isFormOpen) setIsFormOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, confirmDeleteId, editingId, lightboxPhoto]);

  const fetchConditions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/trail-conditions/trail/${encodeURIComponent(trailId)}`, {
        headers: getApiHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && Array.isArray(data.data)) {
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
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.success && Array.isArray(data.data)) {
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
  }, [trailId, viewerId]);

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

  const handleUploadPhotos = async (
    files: FileList | null,
    target: 'create' | 'edit'
  ) => {
    if (!files || files.length === 0) return;
    const currentList = target === 'create' ? photos : editPhotos;
    const remainingSlots = Math.max(0, 4 - currentList.length);
    if (remainingSlots === 0) {
      setFeedback({ text: 'Tối đa 4 ảnh thực địa cho mỗi báo cáo.', type: 'error' });
      return;
    }

    const toProcess = Array.from(files).slice(0, remainingSlots);
    if (target === 'create') setUploadingPhoto(true);
    else setUploadingEditPhoto(true);
    setFeedback(null);

    try {
      const uploadedUrls: string[] = [];
      for (const file of toProcess) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
          reader.readAsDataURL(file);
        });
        const url = await uploadImageToCloudinary(base64, file.name, 'trails');
        uploadedUrls.push(url);
      }
      if (target === 'create') {
        setPhotos((prev) => [...prev, ...uploadedUrls].slice(0, 4));
      } else {
        setEditPhotos((prev) => [...prev, ...uploadedUrls].slice(0, 4));
      }
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Không thể tải ảnh lên máy chủ lúc này.',
        type: 'error',
      });
    } finally {
      if (target === 'create') setUploadingPhoto(false);
      else setUploadingEditPhoto(false);
    }
  };

  const handleStartEdit = (item: ConditionItem) => {
    setConfirmDeleteId(null);
    setEditingId(item._id);
    setEditCondition(item.condition);
    setEditSection(item.section || 'Toàn tuyến');
    setEditWeatherNote(item.weatherNote || '');
    setEditDescription(item.description || '');
    setEditPhotos(Array.isArray(item.photos) ? item.photos.slice(0, 4) : []);
  };

  const handleSaveEdit = async (e: React.FormEvent, conditionId: string) => {
    e.preventDefault();
    if (savingEditId || !editDescription.trim()) return;
    setSavingEditId(conditionId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/trail-conditions/${encodeURIComponent(conditionId)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          status: editCondition,
          condition: editCondition,
          section: editSection,
          weatherNote: editWeatherNote,
          description: editDescription.trim(),
          photos: editPhotos.slice(0, 4),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật báo cáo tình trạng đường.');
      }
      if (data.data) {
        setConditions((prev) =>
          prev.map((item) => (item._id === conditionId ? { ...item, ...data.data } : item))
        );
      }
      setEditingId(null);
      setFeedback({ text: data.message || 'Đã cập nhật báo cáo tình trạng đường thành công!', type: 'success' });
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Không thể cập nhật báo cáo tình trạng đường lúc này.',
        type: 'error',
      });
    } finally {
      setSavingEditId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFeedback(null);

    const token = safeLocalStorageGet('lost_token');
    if (!token) {
      setFeedback({ text: 'Vui lòng đăng nhập tài khoản để gửi báo cáo tình trạng thực địa.', type: 'error' });
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/trail-conditions', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          trailId,
          condition,
          section,
          weatherNote,
          description,
          photos: photos.slice(0, 4),
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setFeedback({ text: data.message || 'Cập nhật tình trạng đường thực địa thành công (+10 điểm uy tín)!', type: 'success' });
        setIsFormOpen(false);
        setDescription('');
        setWeatherNote('');
        setPhotos([]);
        await fetchConditions();
      } else {
        setFeedback({ text: data?.message || 'Không thể gửi báo cáo lúc này.', type: 'error' });
      }
    } catch {
      setFeedback({ text: 'Lỗi kết nối máy chủ khi gửi báo cáo.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    const token = safeLocalStorageGet('lost_token');
    if (!token) {
      setFeedback({ text: 'Vui lòng đăng nhập để xác nhận báo cáo thực địa này.', type: 'error' });
      return;
    }
    if (upvotedIds[id]) return;

    try {
      const res = await fetch(`/api/trail-conditions/${encodeURIComponent(id)}/upvote`, {
        method: 'POST',
        headers: getApiHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setUpvotedIds((prev) => ({ ...prev, [id]: true }));
        setConditions((prev) =>
          prev.map((c) => (c._id === id ? { ...c, upvotes: data.upvotes } : c))
        );
      } else {
        setFeedback({ text: data?.message || 'Chưa thể xác thực báo cáo lúc này.', type: 'error' });
      }
    } catch {
      setFeedback({ text: 'Lỗi kết nối máy chủ khi xác thực báo cáo.', type: 'error' });
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
                ? 'Chưa có dữ liệu quan trắc gần đây — hãy kiểm tra thời tiết MET Norway (CC BY 4.0) và hỏi Trạm Kiểm Lâm trước khi xuất phát.'
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
                  transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
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
              <label htmlFor="condition-create-level" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Mức độ an toàn hiện tại
              </label>
              <select
                id="condition-create-level"
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
              <label htmlFor="condition-create-section" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Phân đoạn ghi nhận
              </label>
              <input
                id="condition-create-section"
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="VD: Trạm Tôn → Lán 2.800m, Đỉnh..."
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="condition-create-weather" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Ghi chú thời tiết / Nhiệt độ (Tùy chọn)
              </label>
              <input
                id="condition-create-weather"
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
            <label htmlFor="condition-create-desc" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
              Chi tiết quan sát thực địa (Mặt đường, nguồn nước, cầu cống, lán nghỉ...)
            </label>
            <textarea
              id="condition-create-desc"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cụ thể tình trạng mặt đường, mức nước suối, lán nghỉ để các đoàn đi sau chuẩn bị trang bị phù hợp..."
              className="form-textarea"
              style={{ width: '100%' }}
            />
          </div>

          {/* Photo Upload (up to 4 photos via /api/upload) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Ảnh hiện trường thực địa (tối đa 4 ảnh · {photos.length}/4)
              </label>
              <label
                htmlFor="condition-create-photo-input"
                className="btn btn-outline"
                style={{
                  padding: '5px 11px',
                  fontSize: '0.74rem',
                  borderRadius: 4,
                  cursor: uploadingPhoto || photos.length >= 4 ? 'not-allowed' : 'pointer',
                  opacity: uploadingPhoto || photos.length >= 4 ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconCamera size={13} color="var(--color-primary)" />
                <span>{uploadingPhoto ? 'Đang tải ảnh...' : 'Thêm ảnh thực địa'}</span>
              </label>
              <input
                id="condition-create-photo-input"
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingPhoto || photos.length >= 4}
                onChange={(e) => {
                  void handleUploadPhotos(e.target.files, 'create');
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </div>

            {photos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {photos.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    style={{
                      position: 'relative',
                      width: 78,
                      height: 60,
                      borderRadius: 4,
                      overflow: 'hidden',
                      border: '1px solid var(--color-border-strong)',
                    }}
                  >
                    <img loading="lazy" decoding="async" src={url} alt={`Ảnh thực địa ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Xóa ảnh ${idx + 1}`}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'var(--overlay-bg)',
                        color: 'var(--color-on-media)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <IconX size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              disabled={isSubmitting || uploadingPhoto}
              className="btn btn-primary"
              style={{ padding: '8px 22px', borderRadius: 4, fontWeight: 800, opacity: isSubmitting || uploadingPhoto ? 0.7 : 1 }}
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
            const isEditingThis = editingId === c._id;
            const authorId =
              c.userId && typeof c.userId === 'object'
                ? String(c.userId._id || c.userId.id || '')
                : String(c.userId || '');
            const isPrivileged = viewerIdentity?.role === 'admin' || viewerIdentity?.role === 'moderator';
            const isOwner = Boolean(viewerIdentity?.id && authorId && viewerIdentity.id === authorId);
            const canModify = Boolean(viewerIdentity && (isOwner || isPrivileged));

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
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {isEditingThis ? (
                  <form onSubmit={(e) => void handleSaveEdit(e, c._id)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconEdit size={15} color="var(--color-primary)" />
                      <span>Chỉnh sửa báo cáo tình trạng thực địa</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                      <div>
                        <label htmlFor={`edit-cond-level-${c._id}`} className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '0.76rem' }}>
                          Mức độ an toàn
                        </label>
                        <select
                          id={`edit-cond-level-${c._id}`}
                          value={editCondition}
                          onChange={(e) => setEditCondition(e.target.value as 'safe' | 'caution' | 'dangerous' | 'closed')}
                          className="form-select"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        >
                          <option value="safe">An toàn • Đường khô ráo</option>
                          <option value="caution">Thận trọng • Trơn trượt / Sương mù</option>
                          <option value="dangerous">Nguy hiểm • Sạt lở / Lũ suối</option>
                          <option value="closed">Tạm đóng • Kiểm lâm cấm tuyến</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`edit-cond-section-${c._id}`} className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '0.76rem' }}>
                          Phân đoạn
                        </label>
                        <input
                          id={`edit-cond-section-${c._id}`}
                          type="text"
                          value={editSection}
                          onChange={(e) => setEditSection(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>

                      <div>
                        <label htmlFor={`edit-cond-weather-${c._id}`} className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '0.76rem' }}>
                          Ghi chú thời tiết
                        </label>
                        <input
                          id={`edit-cond-weather-${c._id}`}
                          type="text"
                          value={editWeatherNote}
                          onChange={(e) => setEditWeatherNote(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`edit-cond-desc-${c._id}`} className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '0.76rem' }}>
                        Mô tả thực địa
                      </label>
                      <textarea
                        id={`edit-cond-desc-${c._id}`}
                        rows={3}
                        required
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="form-textarea"
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Ảnh đính kèm ({editPhotos.length}/4)
                        </span>
                        <label
                          htmlFor={`condition-edit-photo-${c._id}`}
                          className="btn btn-outline"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            borderRadius: 4,
                            cursor: uploadingEditPhoto || editPhotos.length >= 4 ? 'not-allowed' : 'pointer',
                            opacity: uploadingEditPhoto || editPhotos.length >= 4 ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <IconCamera size={12} color="var(--color-primary)" />
                          <span>{uploadingEditPhoto ? 'Đang tải...' : 'Thêm ảnh'}</span>
                        </label>
                        <input
                          id={`condition-edit-photo-${c._id}`}
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingEditPhoto || editPhotos.length >= 4}
                          onChange={(e) => {
                            void handleUploadPhotos(e.target.files, 'edit');
                            e.target.value = '';
                          }}
                          style={{ display: 'none' }}
                        />
                      </div>
                      {editPhotos.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {editPhotos.map((url, idx) => (
                            <div
                              key={`${url}-${idx}`}
                              style={{
                                position: 'relative',
                                width: 72,
                                height: 54,
                                borderRadius: 4,
                                overflow: 'hidden',
                                border: '1px solid var(--color-border-strong)',
                              }}
                            >
                              <img loading="lazy" decoding="async" src={url} alt={`Ảnh báo cáo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              <button
                                type="button"
                                onClick={() => setEditPhotos((prev) => prev.filter((_, i) => i !== idx))}
                                aria-label={`Xóa ảnh ${idx + 1}`}
                                style={{
                                  position: 'absolute',
                                  top: 2,
                                  right: 2,
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: 'var(--overlay-bg)',
                                  color: 'var(--color-on-media)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                <IconX size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={savingEditId === c._id}
                        className="btn btn-outline"
                        style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: 4 }}
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingEditId === c._id || uploadingEditPhoto}
                        className="btn btn-primary"
                        style={{ padding: '6px 16px', fontSize: '0.78rem', fontWeight: 800, borderRadius: 4 }}
                      >
                        {savingEditId === c._id ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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

                      {Array.isArray(c.photos) && c.photos.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          {c.photos.slice(0, 4).map((photoUrl, idx) => (
                            <button
                              key={`${photoUrl}-${idx}`}
                              type="button"
                              onClick={() => setLightboxPhoto(photoUrl)}
                              aria-label={`Phóng to ảnh hiện trường ${idx + 1}`}
                              style={{
                                width: 88,
                                height: 64,
                                borderRadius: 4,
                                overflow: 'hidden',
                                padding: 0,
                                border: '1px solid var(--color-border-strong)',
                                cursor: 'pointer',
                                background: 'var(--color-bg-card)',
                              }}
                            >
                              <img
                                loading="lazy"
                                decoding="async"
                                src={photoUrl}
                                alt={`Hiện trường ${idx + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            </button>
                          ))}
                        </div>
                      )}

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
                        {typeof c.userId?.reputationScore === 'number' && c.userId.reputationScore > 0 && (
                          <span style={{ color: 'var(--color-sun)', fontWeight: 700 }}>
                            · {c.userId.reputationScore} Điểm Uy Tín
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconClock size={11} color="var(--color-text-dim)" />
                          {c.createdAt && Number.isFinite(new Date(c.createdAt).getTime())
                            ? new Date(c.createdAt).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : 'Gần đây'}
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

                      {canModify && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(c)}
                            title="Chỉnh sửa báo cáo tình trạng này"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '7px 10px',
                              borderRadius: 4,
                              border: '1px solid var(--color-border-strong)',
                              background: 'var(--color-bg-card)',
                              color: 'var(--color-text-main)',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <IconEdit size={13} color="var(--color-primary)" />
                            <span>Sửa</span>
                          </button>

                          {(() => {
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
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Condition Photo Lightbox */}
      {lightboxPhoto &&
        createPortal(
          <div
            onClick={() => setLightboxPhoto(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 'var(--z-lightbox, 4000)' as unknown as number,
              padding: 20,
            }}
          >
            <div
              ref={lightboxRef}
              role="dialog"
              aria-modal="true"
              aria-label="Ảnh tình trạng thực địa"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '92vw',
                maxHeight: '88vh',
                background: 'var(--color-bg-card)',
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-3d)',
                outline: 'none',
              }}
            >
              <button
                type="button"
                aria-label="Đóng ảnh (Esc)"
                onClick={() => setLightboxPhoto(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  background: 'var(--overlay-bg)',
                  border: '1px solid color-mix(in srgb, var(--color-on-media) 25%, transparent)',
                  color: 'var(--color-on-media)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              >
                <IconX size={16} />
              </button>
              <img
                loading="lazy"
                decoding="async"
                src={lightboxPhoto}
                alt="Ảnh tình trạng thực địa"
                style={{
                  width: '100%',
                  maxHeight: '88vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});
