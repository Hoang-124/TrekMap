import React, { useState, useEffect, useCallback } from 'react';
import type { Trail, ItineraryStep } from '../../types.js';
import { createExpeditionItinerary, deleteSharedItinerary } from '../../services/api.js';
import { scopedStorageKey } from '../../utils/storageScope.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import {
  IconCalendar,
  IconEdit,
  IconMapPin,
  IconShare,
  IconTrash,
  IconCheck,
  IconX,
} from '../common/SvgIcons.js';

interface SavedItineraryRecord {
  _id?: string;
  shareToken: string;
  title: string;
  trailId?: string | { id?: string; _id?: string; name?: string } | null;
  trailName?: string;
  startDate: string;
  endDate?: string;
  totalDays?: number;
  memberCount: number;
  notes?: string;
  timelineSteps?: Array<{
    day?: number;
    time?: string;
    title?: string;
    activity?: string;
    description?: string;
    notes?: string;
    location?: string;
    locationNote?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

interface ItineraryTabProps {
  trail: Trail;
}

export const ItineraryTab: React.FC<ItineraryTabProps> = ({ trail }) => {
  const storageKey = scopedStorageKey(`lost_itinerary_${trail.id}`);

  const [title, setTitle] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved).title || `Hành trình thám hiểm ${trail.name}`;
      } catch {
        // ignore corrupted cache
      }
    }
    return `Hành trình thám hiểm ${trail.name}`;
  });

  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved).startDate || new Date().toISOString().split('T')[0];
      } catch {
        // ignore corrupted cache
      }
    }
    return new Date().toISOString().split('T')[0];
  });

  const [memberCount, setMemberCount] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved).memberCount || 4;
      } catch {
        // ignore corrupted cache
      }
    }
    return 4;
  });

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [editingShareToken, setEditingShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Saved Cloud Itineraries ("Lịch Trình Đã Lưu Của Tôi")
  const [isSavedListOpen, setIsSavedListOpen] = useState(false);
  const [savedItineraries, setSavedItineraries] = useState<SavedItineraryRecord[]>([]);
  const [loadingSavedList, setLoadingSavedList] = useState(false);
  const [confirmDeleteToken, setConfirmDeleteToken] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);

  const loadMyItineraries = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem('lost_token');
    if (!token) {
      setSavedItineraries([]);
      return;
    }
    setLoadingSavedList(true);
    try {
      const res = await fetch('/api/itineraries/me', {
        headers: getApiHeaders(),
        signal,
      });
      if (!res.ok) {
        setSavedItineraries([]);
        return;
      }
      const json = await res.json();
      if (!signal?.aborted && json?.success && Array.isArray(json.data)) {
        setSavedItineraries(json.data as SavedItineraryRecord[]);
      }
    } catch {
      // Ignore abort or offline error cleanly
    } finally {
      if (!signal?.aborted) setLoadingSavedList(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (localStorage.getItem('lost_token')) {
      fetch('/api/itineraries/me', {
        headers: getApiHeaders(),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!controller.signal.aborted && json?.success && Array.isArray(json.data)) {
            setSavedItineraries(json.data as SavedItineraryRecord[]);
          }
        })
        .catch(() => {
          // Ignore abort or offline error cleanly
        });
    }
    const handleAuthChanged = () => {
      if (localStorage.getItem('lost_token')) {
        void loadMyItineraries();
      } else {
        setSavedItineraries([]);
        setEditingShareToken(null);
      }
    };
    window.addEventListener('lost:auth-changed', handleAuthChanged);
    return () => {
      controller.abort();
      window.removeEventListener('lost:auth-changed', handleAuthChanged);
    };
  }, [loadMyItineraries]);

  const defaultSteps = useCallback((): ItineraryStep[] => {
    const baseSteps: ItineraryStep[] = [
      { day: 1, time: '05:00', title: 'Tập trung & Di chuyển', description: 'Tập trung tại điểm hẹn, kiểm tra balo, di chuyển bằng xe đến chân núi.', locationNote: 'Chân núi / Cửa rừng' },
      { day: 1, time: '08:30', title: 'Bắt đầu trekking', description: 'Gặp Hướng dẫn viên/Porter, làm thủ tục với Kiểm lâm (nếu có) và bắt đầu hành trình.', locationNote: trail.province },
      { day: 1, time: '12:00', title: 'Nghỉ trưa & Ăn nhẹ', description: 'Dừng chân tại suối/trạm nghỉ, bổ sung năng lượng và nước ngọt.', locationNote: 'Trạm nghỉ giữa đường' },
      { day: 1, time: '17:00', title: 'Hạ trại & Dựng lều', description: 'Đến điểm cắm trại, nhóm lửa nấu ăn, thưởng thức bữa tối giữa không gian rừng đêm.', locationNote: trail.hasCampsite ? 'Bãi cắm trại qua đêm' : 'Lán nghỉ' },
    ];

    if (trail.durationDays >= 2) {
      baseSteps.push(
        { day: 2, time: '04:30', title: 'Thức dậy & Săn mây', description: 'Đón bình minh, thưởng thức cà phê/trà nóng và đón biển mây cuồn cuộn.', locationNote: 'Điểm săn mây' },
        { day: 2, time: '06:30', title: 'Chinh phục cột mốc / Đỉnh núi', description: `Chạm tay vào đỉnh ${trail.name} (${trail.maxAltitudeM}m), chụp ảnh lưu niệm cùng nhóm.`, locationNote: `Đỉnh ${trail.name}` },
        { day: 2, time: '09:00', title: 'Thu dọn lều & Hạ sơn', description: 'Dọn sạch rác (LNT policy), kiểm tra đủ quân số và bắt đầu đường về.', locationNote: 'Đường xuống núi' },
        { day: 2, time: '14:30', title: 'Về điểm xuất phát & Kết thúc', description: 'Về đến chân núi, tắm rửa, thưởng thức đặc sản địa phương và chia tay.', locationNote: 'Chân núi' }
      );
    }

    if (trail.durationDays >= 3) {
      baseSteps.push(
        { day: 3, time: '07:00', title: 'Hoàn tất chặng về & Tổng kết', description: 'Di chuyển nốt chặng cuối ra cửa rừng, báo bình an về trạm Kiểm lâm và lên xe về lại trung tâm.', locationNote: trail.province }
      );
    }

    return baseSteps;
  }, [trail.name, trail.province, trail.hasCampsite, trail.durationDays, trail.maxAltitudeM]);

  const [steps, setSteps] = useState<ItineraryStep[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          return parsed.steps;
        }
      } catch {
        // ignore corrupted cache
      }
    }
    return defaultSteps();
  });

  // Auto-save itinerary to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          title,
          startDate,
          memberCount,
          steps,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [storageKey, title, startDate, memberCount, steps]);

  // Listen for AI 1-click Apply live updates (`lost:itinerary-updated`)
  useEffect(() => {
    const handleAiItineraryUpdate = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail;
      if (detail?.trailId && String(detail.trailId) !== String(trail.id)) {
        return;
      }

      const src = detail?.itinerary || detail;
      if (src?.title && typeof src.title === 'string') {
        setTitle(src.title);
      }

      const incomingRaw = Array.isArray(src?.steps)
        ? src.steps
        : Array.isArray(src?.timelineSteps)
        ? src.timelineSteps
        : null;

      if (incomingRaw && incomingRaw.length > 0) {
        const mapped: ItineraryStep[] = incomingRaw.map((rawItem: unknown, idx: number) => {
          const s = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>;
          return {
            day: Math.max(1, Math.min(7, Number(s.day) || 1)),
            time: String(s.time || '07:00'),
            title: String(s.title || s.activity || `Chặng ${idx + 1}`),
            description: String(s.description || s.notes || ''),
            locationNote: String(s.locationNote || s.location || trail.province),
          };
        });
        setSteps(mapped);
        return;
      }

      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.title) setTitle(parsed.title);
          if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
            setSteps(parsed.steps);
          }
        }
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener('lost:itinerary-updated', handleAiItineraryUpdate);
    return () => window.removeEventListener('lost:itinerary-updated', handleAiItineraryUpdate);
  }, [trail.id, trail.province, storageKey]);

  const maxDayOptions = Math.max(
    7,
    Math.min(14, Number(trail.durationDays) || 3),
    ...steps.map((s) => Number(s.day) || 1)
  );
  const dayOptions = Array.from({ length: maxDayOptions }, (_, i) => i + 1);

  const handleAddStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      {
        day: lastStep ? lastStep.day : 1,
        time: '18:00',
        title: 'Hoạt động bổ sung',
        description: 'Mô tả chi tiết hoạt động...',
        locationNote: 'Trạm dừng',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleUpdateStep = <K extends keyof ItineraryStep>(
    index: number,
    field: K,
    value: ItineraryStep[K]
  ) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleSaveItinerary = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!localStorage.getItem('lost_token')) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Vui lòng đăng nhập để lưu lịch trình lên đám mây và tạo link chia sẻ.', type: 'info' },
        })
      );
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }

    setSubmitting(true);

    const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];
    const computedTotalDays = Math.max(1, ...steps.map((s) => Number(s.day) || 1));
    const canonicalSteps = steps.map((s) => ({
      day: s.day,
      time: s.time,
      title: s.title,
      activity: s.title,
      location: s.locationNote || '',
      locationNote: s.locationNote || '',
      description: s.description,
      notes: s.description,
    }));

    const payload = {
      trailId: trail.id,
      title: title || `Kế Hoạch Khám Phá ${trail.name}`,
      startDate: effectiveStartDate,
      totalDays: computedTotalDays,
      memberCount: memberCount || 4,
      timelineSteps: canonicalSteps,
    };

    try {
      if (editingShareToken) {
        const res = await fetch(`/api/itineraries/${encodeURIComponent(editingShareToken)}`, {
          method: 'PUT',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Không thể cập nhật lịch trình lúc này.');
        }
        const nextUrl = `${window.location.origin}/#itinerary/${editingShareToken}`;
        setShareUrl(nextUrl);
        try {
          const cached = JSON.parse(localStorage.getItem('lost_local_itineraries') || '{}');
          cached[editingShareToken] = { ...payload, ...(json.data || {}), shareToken: editingShareToken };
          localStorage.setItem('lost_local_itineraries', JSON.stringify(cached));
        } catch {
          // ignore storage quota errors
        }
        void loadMyItineraries();
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: json.message || 'Đã cập nhật lịch trình đã lưu thành công!', type: 'success' },
          })
        );
      } else {
        const res = await createExpeditionItinerary(payload);
        if (res && res.shareUrl) {
          setShareUrl(res.shareUrl);
          if (res.data?.shareToken) {
            setEditingShareToken(String(res.data.shareToken));
          }
          void loadMyItineraries();
          window.dispatchEvent(
            new CustomEvent('lost:show-toast', {
              detail: { message: 'Đã lưu lịch trình và tạo liên kết chia sẻ thành công!', type: 'success' },
            })
          );
        }
      }
    } catch (err: unknown) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: err instanceof Error ? err.message : 'Vui lòng đăng nhập để lưu và chia sẻ lịch trình.',
            type: 'error',
          },
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadSavedForEdit = (item: SavedItineraryRecord) => {
    setTitle(item.title || `Hành trình thám hiểm ${trail.name}`);
    if (item.startDate) {
      const parsed = new Date(item.startDate);
      if (!Number.isNaN(parsed.getTime())) {
        setStartDate(parsed.toISOString().split('T')[0]);
      }
    }
    setMemberCount(Math.max(1, Number(item.memberCount) || 4));
    const loadedSteps: ItineraryStep[] = (item.timelineSteps || []).map((s, idx) => ({
      day: Math.max(1, Number(s.day) || 1),
      time: String(s.time || '08:00'),
      title: String(s.activity || s.title || `Chặng ${idx + 1}`),
      description: String(s.notes || s.description || ''),
      locationNote: String(s.location || s.locationNote || ''),
    }));
    if (loadedSteps.length > 0) {
      setSteps(loadedSteps);
    }
    setEditingShareToken(item.shareToken);
    setShareUrl(`${window.location.origin}/#itinerary/${item.shareToken}`);
    window.dispatchEvent(
      new CustomEvent('lost:show-toast', {
        detail: { message: `Đã nạp lịch trình "${item.title}" để chỉnh sửa.`, type: 'info' },
      })
    );
  };

  const handleDeleteSaved = async (token: string) => {
    if (!token || deletingToken) return;
    setDeletingToken(token);
    try {
      await deleteSharedItinerary(token);
      setSavedItineraries((prev) => prev.filter((it) => it.shareToken !== token));
      setConfirmDeleteToken(null);
      if (editingShareToken === token) {
        setEditingShareToken(null);
        setShareUrl(null);
      }
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Đã xóa lịch trình đã lưu thành công!', type: 'success' },
        })
      );
    } catch (err: unknown) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: err instanceof Error ? err.message : 'Không thể xóa lịch trình lúc này.',
            type: 'error',
          },
        })
      );
    } finally {
      setDeletingToken(null);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Trình duyệt không cho phép sao chép tự động. Vui lòng chọn và copy link thủ công.', type: 'info' },
          })
        );
      });
  };

  // HTML5 Canvas Card Export (dynamic height — zero step truncation, available pre-save)
  const handleExportCanvasImage = () => {
    const rowHeight = 76;
    const headerHeight = 195;
    const footerHeight = 72;
    const computedHeight = Math.max(760, headerHeight + steps.length * rowHeight + footerHeight);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = computedHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, computedHeight);
    grad.addColorStop(0, '#0c0f0d');
    grad.addColorStop(1, '#141916');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, computedHeight);

    const canvasFont = "'Plus Jakarta Sans', 'Inter', 'Be Vietnam Pro', sans-serif";

    ctx.fillStyle = '#52b788';
    ctx.font = `bold 24px ${canvasFont}`;
    ctx.fillText('LOST — LỊCH TRÌNH THÁM HIỂM', 48, 58);

    ctx.fillStyle = '#f4f3ee';
    ctx.font = `bold 21px ${canvasFont}`;
    ctx.fillText(title.slice(0, 56), 48, 100);

    ctx.fillStyle = '#a8b0aa';
    ctx.font = `15px ${canvasFont}`;
    ctx.fillText(
      `Cung đường: ${trail.name} (${trail.maxAltitudeM}m) · Khởi hành: ${startDate} · Đoàn: ${memberCount} người`,
      48,
      134
    );

    ctx.strokeStyle = 'rgba(244, 243, 238, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, 156);
    ctx.lineTo(752, 156);
    ctx.stroke();

    let yPos = 196;
    steps.forEach((s) => {
      ctx.fillStyle = '#52b788';
      ctx.beginPath();
      ctx.arc(58, yPos - 6, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#d4a348';
      ctx.font = `bold 15px ${canvasFont}`;
      ctx.fillText(`[Ngày ${s.day} · ${s.time}]`, 80, yPos);

      ctx.fillStyle = '#f4f3ee';
      ctx.font = `bold 16px ${canvasFont}`;
      ctx.fillText((s.title || '').slice(0, 44), 232, yPos);

      ctx.fillStyle = '#a8b0aa';
      ctx.font = `14px ${canvasFont}`;
      const desc = s.description.length > 74 ? `${s.description.substring(0, 74)}...` : s.description;
      ctx.fillText(desc, 80, yPos + 25);

      yPos += rowHeight;
    });

    ctx.fillStyle = '#6fa8c7';
    ctx.font = `bold 14px ${canvasFont}`;
    ctx.fillText('LOST Vietnam · Bản Đồ Địa Hình & Cứu Hộ Quốc Gia 112 / 114', 48, computedHeight - 28);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Lich_Trinh_${trail.id}_LOST.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="detail-split-grid">
      {/* Left Column: Interactive Timeline Stepper */}
      <div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 6 }}>Lộ trình hành quân</div>
              <h3 className="font-editorial" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Lịch trình thời gian chi tiết
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
                Tùy chỉnh mốc thời gian (hỗ trợ đến {maxDayOptions} ngày), thêm hoặc xóa chặng di chuyển của đoàn thám hiểm.
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', paddingLeft: 22 }}>
            <div style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 1, background: 'var(--color-border-strong)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {steps.map((step, idx) => (
                <div key={idx} style={{ position: 'relative', background: 'var(--color-bg-main)', padding: 14, borderRadius: 4, border: '1px solid var(--color-border)' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: -19,
                      top: 20,
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      background: 'var(--color-primary)',
                    }}
                  />

                  {/* Responsive Step Controls Row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <select
                      className="form-select"
                      value={step.day}
                      onChange={(e) => handleUpdateStep(idx, 'day', Number(e.target.value))}
                      aria-label="Chọn ngày"
                      style={{ flex: '0 0 92px', fontSize: '0.8rem', padding: '5px 8px' }}
                    >
                      {dayOptions.map((d) => (
                        <option key={d} value={d}>Ngày {d}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="form-input"
                      value={step.time}
                      onChange={(e) => handleUpdateStep(idx, 'time', e.target.value)}
                      aria-label="Giờ thực hiện"
                      style={{ flex: '0 0 84px', fontSize: '0.8rem', padding: '5px 8px', textAlign: 'center' }}
                    />

                    <input
                      type="text"
                      className="form-input"
                      value={step.title}
                      onChange={(e) => handleUpdateStep(idx, 'title', e.target.value)}
                      aria-label="Tiêu đề chặng"
                      style={{ flex: '1 1 180px', fontSize: '0.85rem', fontWeight: 700, padding: '5px 8px' }}
                    />

                    <input
                      type="text"
                      className="form-input"
                      value={step.locationNote || ''}
                      onChange={(e) => handleUpdateStep(idx, 'locationNote', e.target.value)}
                      placeholder="Địa điểm / Mốc (VD: Lán 2.800m, Suối...)"
                      aria-label="Địa điểm chặng"
                      style={{ flex: '1 1 160px', fontSize: '0.78rem', padding: '5px 8px' }}
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      style={{
                        flex: '0 0 auto',
                        background: 'transparent',
                        border: '1px solid var(--color-error)',
                        borderRadius: 4,
                        color: 'var(--color-error-text, var(--color-error))',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '5px 10px',
                      }}
                    >
                      Xóa
                    </button>
                  </div>

                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={step.description}
                    onChange={(e) => handleUpdateStep(idx, 'description', e.target.value)}
                    aria-label="Mô tả chặng"
                    style={{ fontSize: '0.82rem', padding: '6px 8px', width: '100%' }}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleAddStep}
              style={{ marginTop: 16, width: '100%', justifyContent: 'center', borderStyle: 'dashed', borderRadius: 4 }}
            >
              + Thêm mốc thời gian mới
            </button>
          </div>
        </div>

        {/* Saved Cloud Itineraries Collapsible Panel */}
        <div className="card" style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              const next = !isSavedListOpen;
              setIsSavedListOpen(next);
              if (next && localStorage.getItem('lost_token')) {
                void loadMyItineraries();
              }
            }}
            aria-expanded={isSavedListOpen}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              textAlign: 'left',
              color: 'var(--color-text-main)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconCalendar size={18} color="var(--color-primary)" />
              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Lịch Trình Đã Lưu Của Tôi ({savedItineraries.length})
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)' }}>
                  Mở để tải lại lên chỉnh sửa, mở link chia sẻ hoặc xóa các lịch trình đã lưu trên đám mây
                </div>
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isSavedListOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isSavedListOpen && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!localStorage.getItem('lost_token') ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 10px' }}>
                  Vui lòng đăng nhập để xem và quản lý danh sách lịch trình đã lưu của bạn.
                </div>
              ) : loadingSavedList ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 10px' }}>
                  Đang tải danh sách lịch trình đã lưu...
                </div>
              ) : savedItineraries.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 10px', border: '1px dashed var(--color-border)', borderRadius: 4 }}>
                  Bạn chưa lưu lịch trình nào lên đám mây. Hãy bấm &ldquo;Lưu Lịch Trình &amp; Tạo Link Chia Sẻ&rdquo; ở khung bên phải!
                </div>
              ) : (
                savedItineraries.map((item) => {
                  const itemTrailName =
                    item.trailName ||
                    (typeof item.trailId === 'object' && item.trailId !== null ? item.trailId.name : '') ||
                    'Núi Việt Nam';
                  const isEditingThis = editingShareToken === item.shareToken;
                  const isConfirming = confirmDeleteToken === item.shareToken;
                  const isDeletingThis = deletingToken === item.shareToken;

                  return (
                    <div
                      key={item.shareToken}
                      style={{
                        background: 'var(--color-bg-main)',
                        border: isEditingThis ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', fontWeight: 700 }}>
                              <IconMapPin size={12} color="var(--color-primary)" />
                              {itemTrailName}
                            </span>
                            <span>· Khởi hành: {item.startDate ? new Date(item.startDate).toLocaleDateString('vi-VN') : 'Chưa rõ'}</span>
                            <span>· {item.memberCount || 1} người</span>
                            <span>· {(item.timelineSteps || []).length} chặng</span>
                          </div>
                        </div>

                        {isEditingThis && (
                          <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                            Đang chỉnh sửa
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleLoadSavedForEdit(item)}
                          style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <IconEdit size={12} color="var(--color-primary)" />
                          <span>Tải lên chỉnh sửa</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            window.location.hash = `#itinerary/${item.shareToken}`;
                          }}
                          style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <IconShare size={12} color="var(--color-sky)" />
                          <span>Mở link chia sẻ</span>
                        </button>

                        {isConfirming ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                            }}
                          >
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))' }}>
                              Xóa lịch trình này?
                            </span>
                            <button
                              type="button"
                              disabled={isDeletingThis}
                              onClick={() => void handleDeleteSaved(item.shareToken)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: 'none',
                                background: 'var(--color-error)',
                                color: 'var(--color-on-danger)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: isDeletingThis ? 'wait' : 'pointer',
                              }}
                            >
                              {isDeletingThis ? 'Đang xóa...' : 'Xác nhận'}
                            </button>
                            <button
                              type="button"
                              disabled={isDeletingThis}
                              onClick={() => setConfirmDeleteToken(null)}
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
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteToken(item.shareToken)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 10px',
                              borderRadius: 4,
                              border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
                              background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                              color: 'var(--color-error-text, var(--color-error))',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <IconTrash size={12} color="var(--color-error)" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Form Settings & Zalo Share Export */}
      <div>
        <div className="card" style={{ position: 'sticky', top: 84 }}>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Xuất bản lịch trình</div>
          <h3 className="font-editorial" style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 14 }}>
            Thông Tin Lịch Trình Đoàn
          </h3>

          {editingShareToken && (
            <div
              style={{
                marginBottom: 14,
                padding: '9px 11px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: '0.76rem',
              }}
            >
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconCheck size={13} color="var(--color-primary)" />
                <span>Đang sửa bản #{editingShareToken.slice(-6)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingShareToken(null);
                  setShareUrl(null);
                }}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  color: 'var(--color-text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconX size={11} /> Tạo bản mới
              </button>
            </div>
          )}

          <form onSubmit={handleSaveItinerary}>
            <div className="form-group">
              <label className="form-label">Tên chuyến đi:</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ngày bắt đầu khởi hành:</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Số lượng thành viên (người):</label>
              <input
                type="number"
                min={1}
                max={100}
                className="form-input"
                value={memberCount}
                onChange={(e) => setMemberCount(Math.max(1, Number(e.target.value)))}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 10, borderRadius: 4 }}
            >
              {submitting
                ? 'Đang lưu...'
                : editingShareToken
                ? 'Cập Nhật Lịch Trình Đã Lưu'
                : 'Lưu Lịch Trình & Tạo Link Chia Sẻ'}
            </button>

            <button
              type="button"
              className="btn btn-earth"
              onClick={handleExportCanvasImage}
              disabled={steps.length === 0}
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem', marginBottom: 14, borderRadius: 4 }}
            >
              Xuất Card Ảnh Gửi Nhóm Zalo (PNG)
            </button>
          </form>

          {/* Share Link Box */}
          {shareUrl && (
            <div style={{ background: 'var(--color-bg-main)', padding: 14, borderRadius: 6, border: '1px solid var(--color-primary)' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', fontWeight: 700, marginBottom: 6 }}>
                LINK CHIA SẺ TRỰC TIẾP:
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    color: 'var(--color-primary)',
                    fontSize: '0.78rem',
                    padding: '5px 8px',
                    minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCopyLink}
                  style={{ padding: '5px 10px', borderRadius: 4, flexShrink: 0 }}
                >
                  {copied ? 'Đã copy' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
