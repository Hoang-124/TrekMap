import React, { useEffect, useRef, useState } from 'react';
import {
  IconBackpack,
  IconShieldAlert,
  IconCheckCircle,
  IconAlertTriangle,
  IconPlus,
  IconSparkles,
  IconDroplet,
} from '../common/SvgIcons.js';
import { mockTrails } from '../../data/seedData.js';
import { auditPackApi, applyGearItemsToTrailChecklist } from '../../services/aiAssistant.service.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { safeLocalStorageGet, scopedStorageKey } from '../../utils/storageScope.js';
import type { Trail } from '../../types.js';
import type { PackAuditItemInput, PackAuditResult } from './ai.types.js';

interface AiPackAuditorProps {
  trails?: Trail[];
  currentTrail?: Trail | null;
  onToast: (msg: string) => void;
}

function computeCheckedPackKg(list: PackAuditItemInput[]): number {
  const totalGrams = list
    .filter((it) => it.checked !== false && it.name.trim())
    .reduce((sum, it) => sum + Math.max(0, Number(it.weightGrams) || 0), 0);
  if (totalGrams <= 0) return 1;
  return Math.max(1, Math.min(35, Math.round((totalGrams / 1000) * 10) / 10));
}

function hydrateChecklistForTrail(trailId: string): PackAuditItemInput[] {
  try {
    const legacyKey = `lost_checklist_${trailId}`;
    const scopedKey = scopedStorageKey(legacyKey);
    const raw = localStorage.getItem(scopedKey) ?? localStorage.getItem(legacyKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((it: { name?: string; weightGrams?: number; checked?: boolean }) => ({
          name: String(it.name || ''),
          weightGrams: Number(it.weightGrams) || 250,
          checked: it.checked !== false,
        }));
      }
    }
  } catch {
    // fallback default starter kit
  }

  return [
    { name: 'Giày trekking đế gai', weightGrams: 850, checked: true },
    { name: 'Balo trợ lực 40L', weightGrams: 1350, checked: true },
    { name: 'Bình nước 2 lít', weightGrams: 300, checked: true },
    { name: 'Áo mưa bộ 2 lớp', weightGrams: 450, checked: true },
    { name: 'Đèn pin đội đầu', weightGrams: 200, checked: true },
    { name: 'Sạc dự phòng 20.000mAh', weightGrams: 420, checked: true },
  ];
}

export const AiPackAuditor: React.FC<AiPackAuditorProps> = ({ trails, currentTrail, onToast }) => {
  const trailCatalog = trails && trails.length > 0 ? trails : mockTrails;
  const initialTrailId = currentTrail?.id || trailCatalog[0]?.id || 'trail-fansipan';

  const [selectedTrailId, setSelectedTrailId] = useState<string>(initialTrailId);
  const [bodyWeightKg, setBodyWeightKg] = useState<number>(62);
  const [bodyWeightInput, setBodyWeightInput] = useState<string>('62');
  const [items, setItems] = useState<PackAuditItemInput[]>(() => hydrateChecklistForTrail(initialTrailId));
  const [packWeightManual, setPackWeightManual] = useState<boolean>(false);
  const [packWeightKg, setPackWeightKg] = useState<number>(() =>
    computeCheckedPackKg(hydrateChecklistForTrail(initialTrailId))
  );
  const [packWeightInput, setPackWeightInput] = useState<string>(() =>
    String(computeCheckedPackKg(hydrateChecklistForTrail(initialTrailId)))
  );
  const [cloudChecklistSynced, setCloudChecklistSynced] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PackAuditResult | null>(null);
  const [appliedAll, setAppliedAll] = useState(false);

  const auditAbortRef = useRef<AbortController | null>(null);
  const auditReqIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      auditAbortRef.current?.abort();
    };
  }, []);

  // Hydrate authoritative cloud checklist when logged in so cloud gear is audited accurately
  useEffect(() => {
    if (typeof window === 'undefined' || !safeLocalStorageGet('lost_token')) {
      return;
    }
    const controller = new AbortController();
    const targetTrailId = selectedTrailId;

    fetch(`/api/gear-checklists/${encodeURIComponent(targetTrailId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        const cloudData = json?.success && json?.data ? json.data : null;
        if (cloudData && Array.isArray(cloudData.items) && cloudData.items.length > 0) {
          const mapped: PackAuditItemInput[] = cloudData.items.map(
            (it: { name?: string; weightGrams?: number; checked?: boolean }) => ({
              name: String(it.name || ''),
              weightGrams: Number(it.weightGrams) || 250,
              checked: it.checked !== false,
            })
          );
          setItems(mapped);
          const autoKg = computeCheckedPackKg(mapped);
          setPackWeightKg(autoKg);
          setPackWeightInput(String(autoKg));
          setPackWeightManual(false);
          if (typeof cloudData.bodyWeightKg === 'number' && cloudData.bodyWeightKg >= 30 && cloudData.bodyWeightKg <= 180) {
            const bw = Math.round(cloudData.bodyWeightKg);
            setBodyWeightKg(bw);
            setBodyWeightInput(String(bw));
          }
          setCloudChecklistSynced(true);
          try {
            localStorage.setItem(scopedStorageKey(`lost_checklist_${targetTrailId}`), JSON.stringify(cloudData.items));
          } catch {
            // ignore storage errors
          }
        } else {
          setCloudChecklistSynced(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCloudChecklistSynced(false);
      });

    return () => controller.abort();
  }, [selectedTrailId]);

  const syncPackWeightIfAuto = (nextItems: PackAuditItemInput[]) => {
    if (!packWeightManual) {
      const nextKg = computeCheckedPackKg(nextItems);
      setPackWeightKg(nextKg);
      setPackWeightInput(String(nextKg));
    }
  };

  const commitBodyWeight = (raw: string): number => {
    const parsed = Number(raw.replace(',', '.'));
    const clamped =
      raw.trim() !== '' && Number.isFinite(parsed)
        ? Math.max(35, Math.min(150, Math.round(parsed)))
        : bodyWeightKg;
    setBodyWeightKg(clamped);
    setBodyWeightInput(String(clamped));
    return clamped;
  };

  const commitPackWeight = (raw: string): number => {
    const parsed = Number(raw.replace(',', '.'));
    const clamped =
      raw.trim() !== '' && Number.isFinite(parsed)
        ? Math.max(1, Math.min(35, Math.round(parsed * 10) / 10))
        : packWeightKg;
    setPackWeightKg(clamped);
    setPackWeightInput(String(clamped));
    return clamped;
  };

  const handleChangeTrail = (nextId: string) => {
    auditAbortRef.current?.abort();
    auditReqIdRef.current += 1;
    setSelectedTrailId(nextId);
    const hydrated = hydrateChecklistForTrail(nextId);
    setItems(hydrated);
    const nextKg = computeCheckedPackKg(hydrated);
    setPackWeightKg(nextKg);
    setPackWeightInput(String(nextKg));
    setPackWeightManual(false);
    setCloudChecklistSynced(false);
    setLoading(false);
    setResult(null);
    setAppliedAll(false);
  };

  const handleToggleItem = (idx: number) => {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it));
      syncPackWeightIfAuto(next);
      return next;
    });
  };

  const handleAddCustomItem = () => {
    const clean = customItemName.trim();
    if (!clean) return;
    setItems((prev) => {
      const next = [...prev, { name: clean, weightGrams: 250, checked: true }];
      syncPackWeightIfAuto(next);
      return next;
    });
    setCustomItemName('');
  };

  const handleRunAudit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const resolvedBodyKg = commitBodyWeight(bodyWeightInput);
    const resolvedPackKg = commitPackWeight(packWeightInput);
    auditAbortRef.current?.abort();
    const ctrl = new AbortController();
    auditAbortRef.current = ctrl;
    const reqId = ++auditReqIdRef.current;

    setLoading(true);
    setAppliedAll(false);
    try {
      const data = await auditPackApi(
        {
          trailId: selectedTrailId,
          bodyWeightKg: resolvedBodyKg,
          packWeightKg: resolvedPackKg,
          packedItems: items,
        },
        trailCatalog,
        ctrl.signal
      );
      if (isMountedRef.current && reqId === auditReqIdRef.current) {
        setResult(data);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
    } finally {
      if (isMountedRef.current && reqId === auditReqIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleApplyMissingToChecklist = async () => {
    if (!result) return;
    const allMissing = [...result.criticalMissing, ...result.recommendedAdditions];
    if (allMissing.length === 0) return;

    // Preserve any custom items added in this panel alongside missing recommended gear
    const existingNames = new Set(allMissing.map((m) => m.name.trim().toLowerCase()));
    const customItemsPayload = items
      .filter((it) => it.checked !== false && it.name.trim() && !existingNames.has(it.name.trim().toLowerCase()))
      .map((it) => ({
        name: it.name.trim(),
        category: 'Khác' as const,
        weightGrams: it.weightGrams ?? 250,
        isEssential: false,
        reason: 'Đồ bạn tự thêm vào balo',
      }));

    const res = await applyGearItemsToTrailChecklist(
      result.trailId,
      result.trailName,
      [
        ...customItemsPayload,
        ...allMissing.map((m) => ({
          name: m.name,
          category: m.category,
          weightGrams: m.weightGrams,
          isEssential: m.severity === 'critical',
          reason: m.reason,
        })),
      ],
      {
        bodyWeightKg,
        durationDays: result.durationDays,
      }
    );

    if (!isMountedRef.current) return;

    // Merge newly added missing items directly into view state without dropping user's custom entries
    setItems((prev) => {
      const seen = new Set(prev.map((it) => it.name.trim().toLowerCase()));
      const additions: PackAuditItemInput[] = allMissing
        .filter((m) => !seen.has(m.name.trim().toLowerCase()))
        .map((m) => ({ name: m.name, weightGrams: m.weightGrams, checked: true }));
      const merged = [...prev, ...additions];
      syncPackWeightIfAuto(merged);
      return merged;
    });
    setAppliedAll(true);
    onToast(
      res.addedCount > 0
        ? `Đã thêm ${res.addedCount} món vào checklist ${result.trailName}${res.cloudSynced ? ' (đồng bộ đám mây)' : ''}.`
        : 'Các món này đã có sẵn trong checklist của cung đường.'
    );
  };

  const readinessStrokeColor =
    !result
      ? 'var(--color-primary)'
      : result.readinessGrade === 'SẴN SÀNG'
      ? 'var(--color-primary)'
      : result.readinessGrade === 'CẦN BỔ SUNG'
      ? 'var(--color-earth)'
      : 'var(--color-error)';

  const readinessTextColor =
    !result
      ? 'var(--color-primary)'
      : result.readinessGrade === 'SẴN SÀNG'
      ? 'var(--color-primary)'
      : result.readinessGrade === 'CẦN BỔ SUNG'
      ? 'var(--color-earth)'
      : 'var(--color-error-text, var(--color-error))';

  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = result ? ringCircumference * (1 - result.readinessScore / 100) : ringCircumference;

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--color-bg-card)',
      }}
    >
      <form
        onSubmit={(e) => void handleRunAudit(e)}
        style={{
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-earth)', fontWeight: 800, fontSize: '0.82rem' }}>
            <IconBackpack size={15} color="var(--color-earth)" />
            <span>Rà soát balo &amp; đồ an toàn cần mang</span>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              color: cloudChecklistSynced ? 'var(--color-primary)' : 'var(--color-text-dim)',
              fontWeight: cloudChecklistSynced ? 700 : 500,
            }}
          >
            {cloudChecklistSynced
              ? 'Đã lấy từ checklist đã lưu của bạn'
              : 'So theo nhiệt độ đỉnh · nguồn nước · giấy phép'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', gridColumn: 'span 2' }}>
            <span>Cung đường bạn chuẩn bị đi ({trailCatalog.length} cung)</span>
            <select
              value={selectedTrailId}
              onChange={(e) => handleChangeTrail(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.77rem',
                fontFamily: 'var(--font-family)',
              }}
            >
              {trailCatalog.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.maxAltitudeM.toLocaleString('vi-VN')}m · {t.province})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Cân nặng cơ thể (kg)</span>
            <input
              type="number"
              min={35}
              max={150}
              value={bodyWeightInput}
              onChange={(e) => {
                const raw = e.target.value;
                setBodyWeightInput(raw);
                const n = Number(raw);
                if (raw.trim() !== '' && Number.isFinite(n) && n >= 35 && n <= 150) {
                  setBodyWeightKg(Math.round(n));
                }
              }}
              onBlur={() => commitBodyWeight(bodyWeightInput)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-family)',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span>Tổng nặng balo (kg)</span>
              {packWeightManual && (
                <button
                  type="button"
                  onClick={() => {
                    const autoKg = computeCheckedPackKg(items);
                    setPackWeightManual(false);
                    setPackWeightKg(autoKg);
                    setPackWeightInput(String(autoKg));
                  }}
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Tự tính
                </button>
              )}
            </span>
            <input
              type="number"
              min={1}
              max={35}
              step={0.5}
              value={packWeightInput}
              onChange={(e) => {
                const raw = e.target.value;
                setPackWeightManual(true);
                setPackWeightInput(raw);
                const n = Number(raw);
                if (raw.trim() !== '' && Number.isFinite(n) && n >= 1 && n <= 35) {
                  setPackWeightKg(Math.round(n * 10) / 10);
                }
              }}
              onBlur={() => commitPackWeight(packWeightInput)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-family)',
              }}
            />
          </label>
        </div>

        {/* Auto-hydrated Packed Gear Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span style={{ fontWeight: 700 }}>
              Đồ đã xếp trong balo ({items.filter((i) => i.checked !== false).length}/{items.length} món)
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
              Tự lấy từ checklist cung đường
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 112, overflowY: 'auto', padding: 2 }}>
            {items.map((it, idx) => {
              const checked = it.checked !== false;
              return (
                <button
                  key={`${it.name}-${idx}`}
                  type="button"
                  onClick={() => handleToggleItem(idx)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.71rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: checked
                      ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-card))'
                      : 'var(--color-bg-card)',
                    color: checked ? 'var(--color-text-main)' : 'var(--color-text-dim)',
                    border: checked
                      ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                      : '1px solid var(--color-border)',
                    textDecoration: checked ? 'none' : 'line-through',
                  }}
                >
                  {it.name}
                </button>
              );
            })}
          </div>

          {/* Quick Add Custom Gear */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomItem();
                }
              }}
              placeholder="Thêm món bạn mang theo (vd: Áo lông vũ, Túi ngủ 5°C, CCCD...)"
              style={{
                flex: 1,
                padding: '6px 9px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-family)',
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomItem}
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-surface-elevated)',
                color: 'var(--color-text-main)',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <IconPlus size={12} />
              <span>Thêm</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: 4,
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: loading ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <IconSparkles size={14} color="var(--color-on-primary)" />
          <span>{loading ? 'Đang kiểm tra balo theo điều kiện cung...' : 'Kiểm tra danh sách đồ trong balo'}</span>
        </button>
      </form>

      {/* Audit Result Dashboard */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Top Readiness Ring & Trail Context */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderLeft: `3px solid ${readinessStrokeColor}`,
              borderRadius: 6,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {/* Pure SVG Readiness Gauge Ring */}
            <svg width={84} height={84} viewBox="0 0 84 84" role="img" aria-label={`Điểm sẵn sàng ${result.readinessScore}/100`}>
              <circle cx={42} cy={42} r={ringRadius} fill="none" stroke="var(--color-surface-elevated)" strokeWidth={7} />
              <circle
                cx={42}
                cy={42}
                r={ringRadius}
                fill="none"
                stroke={readinessStrokeColor}
                strokeWidth={7}
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                transform="rotate(-90 42 42)"
              />
              <text
                x="42"
                y="45"
                textAnchor="middle"
                fill="var(--color-text-main)"
                fontSize="16"
                fontWeight="800"
                fontFamily="var(--font-family)"
              >
                {result.readinessScore}
              </text>
            </svg>

            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: `color-mix(in srgb, ${readinessStrokeColor} 15%, transparent)`,
                    color: readinessTextColor,
                  }}
                >
                  {result.readinessGrade}
                </span>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Tỷ lệ balo: {result.packRatioPercent}% cân nặng cơ thể
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                {result.weatherNote}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                <span>Đỉnh {result.maxAltitudeM.toLocaleString('vi-VN')}m</span>
                <span>·</span>
                <span style={{ color: result.hasWaterSource ? 'var(--color-sky)' : 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                  <IconDroplet size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  {result.hasWaterSource ? 'Có nguồn nước suối' : 'Tuyến khô (ít nước)'}
                </span>
                <span>·</span>
                <span>{result.permitRequired ? 'Cần CCCD & giấy phép' : 'Tự do (mang CCCD)'}</span>
              </div>
            </div>
          </div>

          {/* Critical Safety Omissions */}
          {result.criticalMissing.length > 0 && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))',
                border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                borderLeft: '3px solid var(--color-error)',
                borderRadius: 6,
                padding: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-error-text, var(--color-error))', fontSize: '0.78rem', fontWeight: 800 }}>
                <IconShieldAlert size={14} color="var(--color-error-text, var(--color-error))" />
                <span>Còn thiếu đồ an toàn quan trọng ({result.criticalMissing.length} món)</span>
              </div>
              {result.criticalMissing.map((m, idx) => (
                <div key={idx} style={{ background: 'var(--color-bg-card)', padding: '7px 9px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.77rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    <span>{m.name}</span>
                    <span style={{ color: 'var(--color-error-text, var(--color-error))', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>+{m.weightGrams}g</span>
                  </div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{m.reason}</div>
                </div>
              ))}
            </div>
          )}

          {/* Recommended Additions */}
          {result.recommendedAdditions.length > 0 && (
            <div
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-sky)', fontSize: '0.77rem', fontWeight: 800 }}>
                <IconAlertTriangle size={13} color="var(--color-sky)" />
                <span>Nên mang thêm ({result.recommendedAdditions.length} món)</span>
              </div>
              {result.recommendedAdditions.map((m, idx) => (
                <div key={idx} style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  <strong style={{ color: 'var(--color-text-main)' }}>{m.name}</strong> ({m.weightGrams}g) — {m.reason}
                </div>
              ))}
            </div>
          )}

          {/* Weight-Saving Tips */}
          {result.weightSavingTips.length > 0 && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-main))',
                border: '1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)',
                borderRadius: 6,
                padding: 10,
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: 4 }}>
                Gợi ý giảm tải balo:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {result.weightSavingTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 1-Click Apply All Missing Gear to Checklist */}
          {(result.criticalMissing.length > 0 || result.recommendedAdditions.length > 0) && (
            <button
              type="button"
              disabled={appliedAll}
              onClick={() => void handleApplyMissingToChecklist()}
              style={{
                padding: '9px 14px',
                borderRadius: 4,
                background: appliedAll ? 'var(--color-surface-elevated)' : 'var(--color-primary)',
                color: appliedAll ? 'var(--color-primary)' : 'var(--color-on-primary)',
                border: appliedAll ? '1px solid var(--color-primary)' : 'none',
                fontSize: '0.79rem',
                fontWeight: 800,
                cursor: appliedAll ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <IconCheckCircle size={14} />
              <span>
                {appliedAll
                  ? `Đã lưu đồ còn thiếu vào checklist ${result.trailName}`
                  : `Thêm ${result.criticalMissing.length + result.recommendedAdditions.length} món còn thiếu vào checklist`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
