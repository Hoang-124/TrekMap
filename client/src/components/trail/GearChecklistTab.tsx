import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Trail } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { safeLocalStorageGet, scopedStorageKey } from '../../utils/storageScope.js';
import { IconPlus, IconTrash } from '../common/SvgIcons.js';

type GearCategory =
  | 'Trang phục'
  | 'Đồ ngủ & Lán'
  | 'Ăn uống & Nước'
  | 'Y tế & An toàn'
  | 'Điện tử'
  | 'Khác';

interface GearItem {
  id: string;
  name: string;
  category: GearCategory;
  weightGrams: number;
  isEssential: boolean;
  checked: boolean;
  reason?: string;
}

interface GearChecklistTabProps {
  trail: Trail;
}

const GUEST_WEIGHT_STORAGE_KEY = 'lost_guest_body_weight_kg';
const GEAR_CATEGORIES: GearCategory[] = [
  'Trang phục',
  'Đồ ngủ & Lán',
  'Ăn uống & Nước',
  'Y tế & An toàn',
  'Điện tử',
  'Khác',
];

function normalizeCategory(raw?: string): GearCategory {
  if (!raw) return 'Khác';
  const match = GEAR_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  const lower = raw.toLowerCase();
  if (lower.includes('áo') || lower.includes('giày') || lower.includes('phục')) return 'Trang phục';
  if (lower.includes('ngủ') || lower.includes('lều') || lower.includes('lán')) return 'Đồ ngủ & Lán';
  if (lower.includes('nước') || lower.includes('ăn') || lower.includes('dinh dưỡng')) return 'Ăn uống & Nước';
  if (lower.includes('y tế') || lower.includes('an toàn') || lower.includes('cứu')) return 'Y tế & An toàn';
  if (lower.includes('điện') || lower.includes('pin') || lower.includes('gps')) return 'Điện tử';
  return 'Khác';
}

export const GearChecklistTab: React.FC<GearChecklistTabProps> = ({ trail }) => {
  const storageKey = scopedStorageKey(`lost_checklist_${trail.id}`);

  const generateDefaultItems = useCallback((): GearItem[] => {
    const base: GearItem[] = [
      { id: '1', name: 'Giày leo núi cổ cao chống trượt', category: 'Trang phục', weightGrams: 850, isEssential: true, checked: true },
      { id: '2', name: 'Balo chuyên dụng trợ lực (35L-50L)', category: 'Trang phục', weightGrams: 1400, isEssential: true, checked: true },
      { id: '3', name: 'Áo mưa bộ 2 lớp chống gió mưa', category: 'Trang phục', weightGrams: 450, isEssential: true, checked: true },
      { id: '4', name: 'Đèn pin đội đầu + 2 viên pin dự phòng', category: 'Điện tử', weightGrams: 200, isEssential: true, checked: true },
      { id: '5', name: 'Túi sơ cứu y tế (Băng gạc, salonpas, thuốc tiêu hóa)', category: 'Y tế & An toàn', weightGrams: 350, isEssential: true, checked: true },
      { id: '6', name: 'Bình chứa nước sinh tồn (2 Lít)', category: 'Ăn uống & Nước', weightGrams: 300, isEssential: true, checked: true },
      { id: '7', name: 'Lương khô / Thức ăn năng lượng hạt', category: 'Ăn uống & Nước', weightGrams: 500, isEssential: true, checked: true },
      { id: '8', name: 'Còi cứu hộ + Dao dã ngoại gấp gọn', category: 'Y tế & An toàn', weightGrams: 180, isEssential: true, checked: true },
      { id: '9', name: 'Sạc dự phòng 20.000mAh', category: 'Điện tử', weightGrams: 420, isEssential: true, checked: true },
    ];

    if (trail.durationDays >= 2) {
      base.push({ id: '10', name: 'Túi ngủ chịu nhiệt 5°C', category: 'Đồ ngủ & Lán', weightGrams: 1100, isEssential: true, checked: true, reason: 'Yêu cầu đi qua đêm' });
      base.push({ id: '11', name: 'Đệm cách nhiệt trải lán', category: 'Đồ ngủ & Lán', weightGrams: 350, isEssential: true, checked: true });
    }

    if (trail.difficultyLevel >= 4) {
      base.push({ id: '12', name: 'Gậy trekking hợp kim nhôm (1 cặp)', category: 'Trang phục', weightGrams: 500, isEssential: true, checked: true, reason: 'Đường dốc đứng cấp 4+' });
      base.push({ id: '13', name: 'Mũ bảo hiểm leo núi chuyên dụng', category: 'Y tế & An toàn', weightGrams: 320, isEssential: true, checked: false, reason: 'Nguy cơ đá lăn' });
    }

    if (trail.maxAltitudeM >= 2500) {
      base.push({ id: '14', name: 'Áo khoác lông vũ siêu nhẹ (ấm -5°C)', category: 'Trang phục', weightGrams: 400, isEssential: true, checked: true, reason: 'Rất lạnh đỉnh cao > 2.500m' });
      base.push({ id: '15', name: 'Găng tay giữ nhiệt & Tất len dự phòng', category: 'Trang phục', weightGrams: 200, isEssential: true, checked: true });
    }

    if (!trail.hasWaterSource) {
      base.push({ id: '16', name: 'Túi nước rỗng 3 Lít phụ', category: 'Ăn uống & Nước', weightGrams: 150, isEssential: true, checked: true, reason: 'Tuyến đường không có nguồn nước' });
    } else {
      base.push({ id: '17', name: 'Bình lọc nước / Viên lọc nước suối', category: 'Ăn uống & Nước', weightGrams: 120, isEssential: true, checked: true });
    }

    base.push({ id: '18', name: 'Máy ảnh Mirrorless + Ống kính', category: 'Điện tử', weightGrams: 1200, isEssential: false, checked: false });
    base.push({ id: '19', name: 'Túi rác tự phân hủy (Zero-waste)', category: 'Khác', weightGrams: 50, isEssential: true, checked: true });

    return base;
  }, [trail.durationDays, trail.difficultyLevel, trail.maxAltitudeM, trail.hasWaterSource]);

  const loadLocalItemsForKey = useCallback(
    (key: string): GearItem[] => {
      const saved = safeLocalStorageGet(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore corrupted storage
        }
      }
      return generateDefaultItems();
    },
    [generateDefaultItems]
  );

  const [trackedTrailId, setTrackedTrailId] = useState<string>(trail.id);
  const [items, setItems] = useState<GearItem[]>(() => loadLocalItemsForKey(storageKey));

  const [userBodyWeightKg, setUserBodyWeightKg] = useState<number>(() => {
    try {
      // Only hydrate guest weight cache when unauthenticated (signed-in users hydrate from cloud)
      if (!localStorage.getItem('lost_token')) {
        const saved = Number(localStorage.getItem(GUEST_WEIGHT_STORAGE_KEY));
        if (Number.isFinite(saved) && saved >= 30 && saved <= 180) return saved;
      }
    } catch {
      // ignore storage error
    }
    return 65;
  });
  const [bodyWeightInput, setBodyWeightInput] = useState<string>(() => String(userBodyWeightKg));

  // Custom item quick-add state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<GearCategory>('Khác');
  const [customWeightInput, setCustomWeightInput] = useState('200');
  const [customEssential, setCustomEssential] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local');
  const [authTick, setAuthTick] = useState(0);
  const [isDesktopSticky, setIsDesktopSticky] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 901px)').matches
      : true
  );
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudLoadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 901px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopSticky(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const handleAuthChanged = () => {
      cloudLoadedKeyRef.current = null;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      setAuthTick((n) => n + 1);
    };
    window.addEventListener('lost:auth-changed', handleAuthChanged);
    return () => window.removeEventListener('lost:auth-changed', handleAuthChanged);
  }, []);

  // Reset checklist items cleanly during render when trail.id changes
  if (trackedTrailId !== trail.id) {
    setTrackedTrailId(trail.id);
    setItems(loadLocalItemsForKey(storageKey));
    setSyncStatus('local');
  }

  // Persist guest bodyWeightKg in localStorage ONLY when unauthenticated (never leak signed-in cloud weight)
  useEffect(() => {
    try {
      if (!localStorage.getItem('lost_token')) {
        localStorage.setItem(GUEST_WEIGHT_STORAGE_KEY, String(userBodyWeightKg));
      }
    } catch {
      // ignore quota errors
    }
  }, [userBodyWeightKg]);

  useEffect(() => {
    cloudLoadedKeyRef.current = null;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const token = safeLocalStorageGet('lost_token');
    if (!token) {
      Promise.resolve().then(() => setSyncStatus('local'));
      return;
    }

    const expectedKey = `${trail.id}|${token}`;
    const controller = new AbortController();
    let cancelled = false;
    fetch(`/api/gear-checklists/${encodeURIComponent(trail.id)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((json) => {
        if (cancelled || controller.signal.aborted) return;
        if (json?.success && json.data && Array.isArray(json.data.items)) {
          if (json.data.items.length > 0 || json.data.updatedAt) {
            setItems(json.data.items);
          }
          if (typeof json.data.bodyWeightKg === 'number' && json.data.bodyWeightKg >= 30) {
            setUserBodyWeightKg(json.data.bodyWeightKg);
            setBodyWeightInput(String(json.data.bodyWeightKg));
          }
          setSyncStatus('synced');
        }
      })
      .catch(() => {
        // Offline -> keep localStorage smoothly
      })
      .finally(() => {
        if (!cancelled && !controller.signal.aborted) {
          cloudLoadedKeyRef.current = expectedKey;
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trail.id, authTick]);

  // Listen for AI 1-click Apply live sync event (`lost:gear-checklist-updated`)
  useEffect(() => {
    const handleAiGearUpdate = (evt: Event) => {
      const detail = (evt as CustomEvent<{ trailId?: string; items?: unknown[] }>)?.detail;
      if (detail?.trailId && String(detail.trailId) !== String(trail.id)) {
        return;
      }

      if (Array.isArray(detail?.items) && detail.items.length > 0) {
        const incoming: GearItem[] = [];
        detail.items.forEach((entry: unknown, idx: number) => {
          if (typeof entry === 'string' && entry.trim()) {
            incoming.push({
              id: `ai-${Date.now()}-${idx}`,
              name: entry.trim(),
              category: 'Khác',
              weightGrams: 250,
              isEssential: true,
              checked: true,
              reason: 'Đề xuất từ LOST AI',
            });
          } else if (entry && typeof entry === 'object' && Array.isArray((entry as { items?: unknown[] }).items)) {
            const group = entry as { category?: string; items: unknown[] };
            const cat = normalizeCategory(group.category);
            group.items.forEach((sub, sIdx: number) => {
              if (typeof sub === 'string' && sub.trim()) {
                incoming.push({
                  id: `ai-${Date.now()}-${idx}-${sIdx}`,
                  name: sub.trim(),
                  category: cat,
                  weightGrams: 250,
                  isEssential: true,
                  checked: true,
                  reason: 'Đề xuất từ LOST AI',
                });
              }
            });
          } else if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
            const itemObj = entry as {
              id?: string;
              name: string;
              category?: string;
              weightGrams?: number;
              isEssential?: boolean;
              checked?: boolean;
              reason?: string;
            };
            if (itemObj.name.trim()) {
              incoming.push({
                id: String(itemObj.id || `ai-${Date.now()}-${idx}`),
                name: itemObj.name.trim(),
                category: normalizeCategory(itemObj.category),
                weightGrams: Math.max(0, Number(itemObj.weightGrams) || 250),
                isEssential: itemObj.isEssential !== false,
                checked: itemObj.checked !== false,
                reason: itemObj.reason || 'Đề xuất từ LOST AI',
              });
            }
          }
        });

        if (incoming.length > 0) {
          setItems((prev) => {
            const existingNames = new Set(prev.map((i) => i.name.trim().toLowerCase()));
            const toAdd = incoming.filter((n) => !existingNames.has(n.name.trim().toLowerCase()));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });
          return;
        }
      }

      // Fallback: reload from localStorage if updated externally
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
          }
        }
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener('lost:gear-checklist-updated', handleAiGearUpdate);
    return () => window.removeEventListener('lost:gear-checklist-updated', handleAiGearUpdate);
  }, [trail.id, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
    const token = safeLocalStorageGet('lost_token');
    if (!token || cloudLoadedKeyRef.current !== `${trail.id}|${token}`) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus('syncing');
    syncTimerRef.current = setTimeout(() => {
      fetch(`/api/gear-checklists/${encodeURIComponent(trail.id)}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: `Checklist ${trail.name}`,
          bodyWeightKg: userBodyWeightKg,
          createdForDays: trail.durationDays,
          items,
        }),
      })
        .then((res) => {
          if (res.ok) setSyncStatus('synced');
          else setSyncStatus('local');
        })
        .catch(() => setSyncStatus('local'));
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items, userBodyWeightKg, storageKey, trail.id, trail.name, trail.durationDays]);

  const toggleCheck = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;
    const weight = Math.max(10, Math.min(20000, Math.round(Number(customWeightInput) || 200)));
    const newItem: GearItem = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      category: customCategory,
      weightGrams: weight,
      isEssential: customEssential,
      checked: true,
      reason: 'Trang bị tự thêm',
    };
    setItems((prev) => [newItem, ...prev]);
    setCustomName('');
    setCustomWeightInput('200');
    setCustomEssential(false);
  };

  const resetChecklist = () => {
    setItems(generateDefaultItems());
  };

  const handleBodyWeightChange = (rawVal: string) => {
    setBodyWeightInput(rawVal);
    const parsed = Number(rawVal);
    if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 180) {
      setUserBodyWeightKg(parsed);
    }
  };

  const handleBodyWeightBlur = () => {
    const parsed = Number(bodyWeightInput);
    const clamped = Number.isFinite(parsed) ? Math.min(180, Math.max(30, Math.round(parsed))) : 65;
    setUserBodyWeightKg(clamped);
    setBodyWeightInput(String(clamped));
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const totalWeightGrams = items
    .filter((i) => i.checked)
    .reduce((sum, item) => sum + item.weightGrams, 0);

  const totalWeightKg = (totalWeightGrams / 1000).toFixed(1);
  const weightRatioPercent = Math.round((Number(totalWeightKg) / Math.max(30, userBodyWeightKg)) * 100);

  return (
    <div className="gear-checklist-grid">
      {/* Left Column: Interactive Gear Checklist */}
      <div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 6 }}>Chuẩn bị hành trang</div>
              <h3 className="font-editorial" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Danh sách trang bị ({checkedCount}/{items.length} món)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
                Đề xuất cho độ khó cấp {trail.difficultyLevel} &amp; hành trình {trail.durationDays} ngày.{' '}
                <span style={{ color: syncStatus === 'synced' ? 'var(--color-primary)' : 'var(--color-sky)', fontWeight: 700 }}>
                  ({syncStatus === 'synced' ? 'Đã đồng bộ đám mây' : syncStatus === 'syncing' ? 'Đang đồng bộ...' : 'Lưu cục bộ'})
                </span>
              </p>
            </div>
            <button type="button" className="btn btn-outline" onClick={resetChecklist} style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: 4 }}>
              Đặt lại ban đầu
            </button>
          </div>

          {/* Add Custom Gear Item Form */}
          <form
            onSubmit={handleAddCustomItem}
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              className="form-input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Thêm vật dụng cá nhân (VD: Gói giữ nhiệt, Ống nhòm...)"
              style={{ flex: '1 1 200px', fontSize: '0.82rem', padding: '7px 10px' }}
            />
            <select
              className="form-select"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value as GearCategory)}
              style={{ flex: '0 1 140px', fontSize: '0.8rem', padding: '7px 8px' }}
            >
              {GEAR_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="number"
              className="form-input"
              min={10}
              max={20000}
              value={customWeightInput}
              onChange={(e) => setCustomWeightInput(e.target.value)}
              aria-label="Trọng lượng (gram)"
              placeholder="Gram"
              style={{ width: 88, fontSize: '0.8rem', padding: '7px 8px' }}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: 'var(--color-text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={customEssential}
                onChange={(e) => setCustomEssential(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Bắt buộc
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '7px 12px', fontSize: '0.78rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <IconPlus size={14} />
              <span>Thêm món</span>
            </button>
          </form>

          {/* Checklist Item List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  style={{
                    background: item.checked ? 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-main))' : 'var(--color-bg-main)',
                    border: item.checked ? '1px solid color-mix(in srgb, var(--color-primary) 34%, transparent)' : '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'border-color 0.18s ease, background-color 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleCheck(item.id)}
                      aria-label={item.name}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)', flexShrink: 0 }}
                    />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: item.checked ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                          textDecoration: item.checked ? 'none' : 'line-through',
                          wordBreak: 'break-word',
                        }}
                      >
                        {item.name}
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-cloud">
                          {item.category}
                        </span>
                        {item.isEssential && (
                          <span className="badge badge-error">
                            Bắt buộc
                          </span>
                        )}
                        {item.reason && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-sun)' }}>
                            · {item.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {item.weightGrams}g
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      title="Xóa khỏi danh sách"
                      aria-label={`Xóa ${item.name}`}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        width: 28,
                        height: 28,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-dim)',
                        cursor: 'pointer',
                      }}
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Backpack Weight Calculator & Overweight Warning */}
      <div>
        <div className="card" style={isDesktopSticky ? { position: 'sticky', top: 84 } : undefined}>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Tải trọng</div>
          <h3 className="font-editorial" style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 14 }}>
            Tính Trọng Lượng Balo
          </h3>

          {/* Total Weight Stat */}
          <div style={{ background: 'var(--color-bg-main)', padding: 16, borderRadius: 4, textAlign: 'center', marginBottom: 16, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700 }}>
              Tổng trọng lượng dự kiến
            </div>
            <div className="font-editorial" style={{ fontSize: '2.5rem', fontWeight: 500, color: 'var(--color-primary)', margin: '4px 0', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
              {totalWeightKg} <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>kg</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {totalWeightGrams.toLocaleString('vi-VN')} grams
            </div>
          </div>

          {/* User Weight Input (Free typing + Clamp on blur) */}
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label" htmlFor="gear-body-weight-input">
              Cân nặng cơ thể của bạn (30–180 kg):
            </label>
            <input
              id="gear-body-weight-input"
              type="number"
              inputMode="numeric"
              min={30}
              max={180}
              className="form-input"
              value={bodyWeightInput}
              onChange={(e) => handleBodyWeightChange(e.target.value)}
              onBlur={handleBodyWeightBlur}
              style={{ fontWeight: 700 }}
            />
          </div>

          {/* Weight Ratio Meter */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-dim)' }}>Tỷ lệ balo / cơ thể:</span>
              <strong style={{ color: weightRatioPercent > 25 ? 'var(--color-error-text, var(--color-error))' : weightRatioPercent > 20 ? 'var(--color-sun)' : 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {weightRatioPercent}% cơ thể
              </strong>
            </div>

            <div style={{ width: '100%', height: 6, background: 'var(--color-bg-main)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <div
                style={{
                  width: `${Math.min(100, weightRatioPercent * 3)}%`,
                  height: '100%',
                  background: weightRatioPercent > 25 ? 'var(--color-error)' : weightRatioPercent > 20 ? 'var(--color-sun)' : 'var(--color-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Overweight Warnings */}
          {weightRatioPercent > 25 ? (
            <div style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)', borderLeft: '3px solid var(--color-error)', padding: 14, borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--color-error-text, var(--color-error))', display: 'block', marginBottom: 4 }}>
                NGUY HIỂM · Balo quá nặng
              </strong>
              Balo chiếm <strong>{weightRatioPercent}%</strong> cân nặng cơ thể (&gt; 25%). Nên lược bỏ bớt vật dụng không thiết yếu để bảo vệ khớp gối &amp; cột sống.
            </div>
          ) : weightRatioPercent > 20 ? (
            <div style={{ background: 'color-mix(in srgb, var(--color-sun) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-sun) 35%, transparent)', borderLeft: '3px solid var(--color-sun)', padding: 14, borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--color-sun)', display: 'block', marginBottom: 4 }}>
                LƯU Ý · Balo tương đối nặng
              </strong>
              Tỷ lệ <strong>{weightRatioPercent}%</strong> nằm ở ngưỡng chịu đựng (20% – 25%). Hãy siết chặt đai trợ lực hông khi di chuyển.
            </div>
          ) : (
            <div style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)', borderLeft: '3px solid var(--color-primary)', padding: 14, borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: 4 }}>
                Tỷ lệ tối ưu
              </strong>
              Trọng lượng balo lý tưởng (&lt; 20% thể trọng), giúp di chuyển linh hoạt và duy trì sức bền trên đường dốc.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
