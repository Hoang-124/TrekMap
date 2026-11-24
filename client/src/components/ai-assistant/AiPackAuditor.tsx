import React, { useEffect, useState } from 'react';
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
import { scopedStorageKey } from '../../utils/storageScope.js';
import type { Trail } from '../../types.js';
import type { PackAuditItemInput, PackAuditResult } from './ai.types.js';

interface AiPackAuditorProps {
  trails?: Trail[];
  currentTrail?: Trail | null;
  onToast: (msg: string) => void;
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
  const [packWeightKg, setPackWeightKg] = useState<number>(9);
  const [items, setItems] = useState<PackAuditItemInput[]>(() => hydrateChecklistForTrail(initialTrailId));
  const [cloudChecklistSynced, setCloudChecklistSynced] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PackAuditResult | null>(null);
  const [appliedAll, setAppliedAll] = useState(false);

  // Hydrate authoritative cloud checklist when logged in so cloud gear is audited accurately
  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('lost_token')) {
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
          if (typeof cloudData.bodyWeightKg === 'number' && cloudData.bodyWeightKg >= 30 && cloudData.bodyWeightKg <= 180) {
            setBodyWeightKg(Math.round(cloudData.bodyWeightKg));
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

  const handleChangeTrail = (nextId: string) => {
    setSelectedTrailId(nextId);
    setItems(hydrateChecklistForTrail(nextId));
    setCloudChecklistSynced(false);
    setResult(null);
    setAppliedAll(false);
  };

  const handleToggleItem = (idx: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it)));
  };

  const handleAddCustomItem = () => {
    const clean = customItemName.trim();
    if (!clean) return;
    setItems((prev) => [...prev, { name: clean, weightGrams: 250, checked: true }]);
    setCustomItemName('');
  };

  const handleRunAudit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setAppliedAll(false);
    try {
      const data = await auditPackApi(
        {
          trailId: selectedTrailId,
          bodyWeightKg,
          packWeightKg,
          packedItems: items,
        },
        trailCatalog
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMissingToChecklist = async () => {
    if (!result) return;
    const allMissing = [...result.criticalMissing, ...result.recommendedAdditions];
    if (allMissing.length === 0) return;

    const res = await applyGearItemsToTrailChecklist(
      result.trailId,
      result.trailName,
      allMissing.map((m) => ({
        name: m.name,
        category: m.category,
        weightGrams: m.weightGrams,
        isEssential: m.severity === 'critical',
        reason: m.reason,
      })),
      {
        bodyWeightKg,
        durationDays: result.durationDays,
      }
    );

    // Also update local view list immediately
    setItems(hydrateChecklistForTrail(result.trailId));
    setAppliedAll(true);
    onToast(
      res.addedCount > 0
        ? `Đã bổ sung ${res.addedCount} món thiếu vào Checklist ${result.trailName}${res.cloudSynced ? ' (đồng bộ đám mây)' : ''}!`
        : 'Các món này đã có sẵn trong Checklist của cung đường.'
    );
  };

  const readinessColor =
    !result
      ? 'var(--color-primary)'
      : result.readinessScore >= 80 && result.criticalMissing.length === 0
      ? 'var(--color-primary)'
      : result.readinessScore >= 55
      ? 'var(--color-earth)'
      : 'var(--color-error)';

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
            <span>KIỂM TOÁN BALO &amp; MỨC ĐỘ SẴN SÀNG SINH TỒN</span>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              color: cloudChecklistSynced ? 'var(--color-primary)' : 'var(--color-text-dim)',
              fontWeight: cloudChecklistSynced ? 700 : 500,
            }}
          >
            {cloudChecklistSynced
              ? 'Đã đồng bộ Checklist Cloud · Đối chiếu thực địa'
              : 'Đối chiếu nhiệt độ đỉnh · nguồn nước · giấy phép'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', gridColumn: 'span 2' }}>
            <span>Cung đường mục tiêu ({trailCatalog.length} tuyến thực địa)</span>
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
                  {t.name} ({t.maxAltitudeM}m · {t.province})
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
              value={bodyWeightKg}
              onChange={(e) => setBodyWeightKg(Math.max(35, Number(e.target.value) || 60))}
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
            <span>Tổng nặng balo (kg)</span>
            <input
              type="number"
              min={1}
              max={35}
              step={0.5}
              value={packWeightKg}
              onChange={(e) => setPackWeightKg(Math.max(1, Number(e.target.value) || 8))}
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
              Tự nạp từ Checklist cung đường
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
          <span>{loading ? 'Đang kiểm toán balo với dữ liệu đỉnh...' : 'Chạy Kiểm Toán An Toàn Balo'}</span>
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
              borderLeft: `3px solid ${readinessColor}`,
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
                stroke={readinessColor}
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
                fontFamily="Plus Jakarta Sans, sans-serif"
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
                    background: `color-mix(in srgb, ${readinessColor} 15%, transparent)`,
                    color: readinessColor,
                  }}
                >
                  {result.readinessGrade}
                </span>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Tỷ lệ balo: {result.packRatioPercent}% thể trọng
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                {result.weatherNote}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                <span>Đỉnh {result.maxAltitudeM.toLocaleString()}m</span>
                <span>·</span>
                <span style={{ color: result.hasWaterSource ? 'var(--color-sky)' : 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                  <IconDroplet size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  {result.hasWaterSource ? 'Có nguồn nước suối' : 'Tuyến khô (ít nước)'}
                </span>
                <span>·</span>
                <span>{result.permitRequired ? 'Cần CCCD / Giấy phép' : 'Tự do (mang CCCD)'}</span>
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
                <span>THIẾU ĐỒ AN TOÀN BẮT BUỘC ({result.criticalMissing.length} món)</span>
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
                <span>NÊN BỔ SUNG THÊM ({result.recommendedAdditions.length} món)</span>
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
                Mẹo tối ưu trọng lượng balo:
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
                  ? `Đã đồng bộ toàn bộ đồ thiếu vào Checklist ${result.trailName}`
                  : `Bổ Sung ${result.criticalMissing.length + result.recommendedAdditions.length} Món Thiếu Vào Checklist`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
