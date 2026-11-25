import React, { useEffect, useRef, useState } from 'react';
import {
  IconCompass,
  IconMountain,
  IconMapPin,
  IconSparkles,
  IconAlertTriangle,
  IconCheckCircle,
  IconBot,
} from '../common/SvgIcons.js';
import { recommendTrailsApi } from '../../services/aiAssistant.service.js';
import { mockTrails } from '../../data/seedData.js';
import type { Trail } from '../../types.js';
import {
  isSafeImageUrl,
  type AiFitnessLevel,
  type TrailMatchResultItem,
  type TrailPreferenceTag,
  type TrailRecommendResponse,
} from './ai.types.js';

interface AiTrailMatchWizardProps {
  trails?: Trail[];
  userCoords?: { lat: number; lng: number } | null;
  onSelectTrail?: (trailId: string) => void;
  onCloseModal?: () => void;
  onAskAiPrompt: (prompt: string, trailId?: string) => void;
}

function getCurrentVietnamMonth(): number {
  try {
    const m = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: 'numeric' }).format(new Date())
    );
    return m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
  } catch {
    return new Date().getMonth() + 1;
  }
}

const PREF_OPTIONS: Array<{ id: TrailPreferenceTag; label: string }> = [
  { id: 'san_may', label: 'Săn biển mây' },
  { id: 'high_peak_2800', label: 'Đỉnh > 2.800m' },
  { id: 'waterfall_forest', label: 'Suối thác & rừng' },
  { id: 'kid_friendly', label: 'Thân thiện gia đình' },
  { id: 'no_permit_needed', label: 'Không cần giấy phép' },
];

export const AiTrailMatchWizard: React.FC<AiTrailMatchWizardProps> = ({
  trails,
  userCoords,
  onSelectTrail,
  onCloseModal,
  onAskAiPrompt,
}) => {
  const catalogCount = trails && trails.length > 0 ? trails.length : mockTrails.length;
  const [fitness, setFitness] = useState<AiFitnessLevel>('intermediate');
  const [region, setRegion] = useState<'all' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam'>('all');
  const [durationDays, setDurationDays] = useState<'any' | 1 | 2 | 3>('any');
  const [targetMonth, setTargetMonth] = useState<number>(() => getCurrentVietnamMonth());
  const [preferences, setPreferences] = useState<TrailPreferenceTag[]>(['san_may']);
  const [useGps, setUseGps] = useState<boolean>(Boolean(userCoords));
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrailRecommendResponse | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const togglePref = (tag: TrailPreferenceTag) => {
    setPreferences((prev) => (prev.includes(tag) ? prev.filter((p) => p !== tag) : [...prev, tag]));
  };

  const handleRunMatchmaker = async (e?: React.FormEvent) => {
    e?.preventDefault();
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const reqId = ++reqIdRef.current;

    setLoading(true);
    try {
      const data = await recommendTrailsApi(
        {
          fitness,
          region,
          durationDays,
          targetMonth,
          preferences,
          userCoordinates: useGps && userCoords ? userCoords : undefined,
        },
        trails,
        ctrl.signal
      );
      if (isMountedRef.current && reqId === reqIdRef.current) {
        setResult(data);
        setFailedCovers({});
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
    } finally {
      if (isMountedRef.current && reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  };

  const formatVndShort = (vnd: number) => `${(vnd / 1_000_000).toFixed(1)}tr`;

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
      {/* Configuration Form */}
      <form
        onSubmit={(e) => void handleRunMatchmaker(e)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.82rem' }}>
            <IconCompass size={15} color="var(--color-primary)" />
            <span>Chọn cung hợp thể lực ({catalogCount} tuyến Việt Nam)</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
            So mùa đẹp + độ khó + cảnh báo mới nhất
          </span>
        </div>

        {/* Fitness + Region + Duration + Month Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Thể lực hiện tại
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(
                [
                  { id: 'beginner', label: 'Mới tập' },
                  { id: 'intermediate', label: 'Khá' },
                  { id: 'advanced', label: 'Tốt' },
                ] as const
              ).map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setFitness(lvl.id)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: fitness === lvl.id ? 'var(--color-primary)' : 'var(--color-bg-card)',
                    color: fitness === lvl.id ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    border: fitness === lvl.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Khu vực</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as 'all' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam')}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-family)',
              }}
            >
              <option value="all">Toàn quốc ({catalogCount} cung)</option>
              <option value="Miền Bắc">Miền Bắc</option>
              <option value="Miền Trung">Miền Trung</option>
              <option value="Miền Nam">Miền Nam &amp; Tây Nguyên</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Thời lượng</span>
            <select
              value={String(durationDays)}
              onChange={(e) => {
                const v = e.target.value;
                setDurationDays(v === 'any' ? 'any' : (Number(v) as 1 | 2 | 3));
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-family)',
              }}
            >
              <option value="any">Mọi thời lượng</option>
              <option value="1">Đi trong ngày (1N)</option>
              <option value="2">Cuối tuần (2N1Đ)</option>
              <option value="3">Dài ngày (3N2Đ+)</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Tháng khởi hành</span>
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(Number(e.target.value))}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-family)',
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Preference Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            Bạn thích kiểu cung nào (chọn nhiều):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PREF_OPTIONS.map((opt) => {
              const active = preferences.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePref(opt.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: active
                      ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                      : 'var(--color-bg-card)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}

            {userCoords && (
              <button
                type="button"
                onClick={() => setUseGps((p) => !p)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 9999,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: useGps
                    ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)'
                    : 'var(--color-bg-card)',
                  color: useGps ? 'var(--color-sky)' : 'var(--color-text-muted)',
                  border: useGps ? '1px solid var(--color-sky)' : '1px solid var(--color-border)',
                }}
              >
                Ưu tiên gần vị trí bạn
              </button>
            )}
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
          <span>{loading ? `Đang lọc từ ${catalogCount} cung đường...` : 'Gợi ý top 5 cung hợp nhất'}</span>
        </button>
      </form>

      {/* Results List */}
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', padding: '0 2px' }}>
            {result.summaryNote}
          </div>

          {result.matches.map((m: TrailMatchResultItem, idx: number) => {
            const seasonBgColor =
              m.seasonStatus === 'ideal'
                ? 'var(--color-primary)'
                : m.seasonStatus === 'avoid'
                ? 'var(--color-error)'
                : 'var(--color-sky)';
            const seasonTextColor =
              m.seasonStatus === 'ideal'
                ? 'var(--color-primary)'
                : m.seasonStatus === 'avoid'
                ? 'var(--color-error-text, var(--color-error))'
                : 'var(--color-sky)';
            const seasonText =
              m.seasonStatus === 'ideal'
                ? `Mùa đẹp T${result.targetMonth}`
                : m.seasonStatus === 'avoid'
                ? `Mùa bất lợi T${result.targetMonth}`
                : `Đi được T${result.targetMonth}`;
            const showCover = isSafeImageUrl(m.coverImage) && !failedCovers[m.id];

            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  borderLeft: `3px solid ${idx === 0 ? 'var(--color-primary)' : 'var(--color-sky)'}`,
                  borderRadius: 6,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {showCover ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={m.coverImage}
                      alt={m.name}
                      onError={() => setFailedCovers((prev) => ({ ...prev, [m.id]: true }))}
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 4,
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid var(--color-border)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 4,
                        background: 'var(--color-surface-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconMountain size={22} color="var(--color-primary)" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                        #{idx + 1} {m.name}
                      </h4>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                          color: 'var(--color-primary)',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {m.matchScore}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                      <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <IconMapPin size={10} /> {m.province}
                      </span>
                      <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)', fontWeight: 700 }}>
                        {m.maxAltitudeM.toLocaleString('vi-VN')}m · {m.distanceKm} km
                      </span>
                      <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: `color-mix(in srgb, ${seasonBgColor} 12%, transparent)`, color: seasonTextColor, fontWeight: 700 }}>
                        {seasonText}
                      </span>
                      <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        ~{formatVndShort(m.estimatedBudgetRangeVnd.min)}–{formatVndShort(m.estimatedBudgetRangeVnd.max)} VNĐ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pros */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {m.pros.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      <IconCheckCircle size={12} color="var(--color-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>

                {/* Warnings */}
                {m.warnings.length > 0 && (
                  <div
                    style={{
                      background: 'color-mix(in srgb, var(--color-earth) 10%, var(--color-bg-card))',
                      border: '1px solid color-mix(in srgb, var(--color-earth) 32%, transparent)',
                      borderRadius: 4,
                      padding: '6px 9px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    {m.warnings.map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.73rem', color: 'var(--color-earth)' }}>
                        <IconAlertTriangle size={12} color="var(--color-earth)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Strip */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
                  {onSelectTrail && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTrail(m.id);
                        onCloseModal?.();
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 4,
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <IconCompass size={12} color="var(--color-on-primary)" />
                      <span>Mở cung đường</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onAskAiPrompt(
                        `Tư vấn chi tiết lịch trình, thời tiết và lưu ý an toàn cho cung ${m.name} đi vào tháng ${result.targetMonth} (thể lực ${
                          fitness === 'beginner' ? 'người mới' : fitness === 'advanced' ? 'tốt' : 'trung bình'
                        })`,
                        m.id
                      )
                    }
                    style={{
                      padding: '5px 10px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border-strong)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconBot size={12} color="var(--color-primary)" />
                    <span>Hỏi AI chi tiết</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAskAiPrompt(`Hôm nay có nên leo ${m.name} không (Go/No-Go)?`, m.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border-strong)',
                      color: 'var(--color-sky)',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconSparkles size={12} color="var(--color-sky)" />
                    <span>Xem Go/No-Go</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: '22px 16px',
            textAlign: 'center',
            background: 'var(--color-bg-main)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            fontSize: '0.8rem',
            lineHeight: 1.6,
          }}
        >
          Chọn thể lực, khu vực, tháng khởi hành và tiêu chí mong muốn rồi bấm{' '}
          <strong style={{ color: 'var(--color-text-main)' }}>Gợi ý top 5 cung hợp nhất</strong> để xem các cung phù hợp trong {catalogCount} tuyến Việt Nam kèm cảnh báo mới nhất.
        </div>
      )}
    </div>
  );
};
