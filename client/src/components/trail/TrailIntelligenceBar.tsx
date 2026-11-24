import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import type { Trail, UserProfile } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import {
  getOfflineTrailPack,
  downloadOfflineTrailPack,
  deleteOfflineTrailPack,
  type OfflineTrailPackRecord,
} from '../../utils/offlinePack.js';
import {
  assessGoNoGoApi,
  applyGearItemsToTrailChecklist,
  queueAiAssistantPrompt,
} from '../../services/aiAssistant.service.js';
import type { GoNoGoAssessmentData } from '../ai-assistant/ai.types.js';
import {
  IconShieldAlert,
  IconSparkles,
  IconMountain,
  IconCheckCircle,
  IconTrash,
  IconFileText,
  IconBot,
  IconDownload,
  IconCopy,
} from '../common/SvgIcons.js';

const Terrain3DModal = lazy(() => import('../map/Terrain3DModal.js'));
const SafetyTimerModal = lazy(() =>
  import('../safety/SafetyTimerModal.js').then((m) => ({ default: m.SafetyTimerModal }))
);

interface PermitTemplateData {
  authority: string;
  isBorderZone: boolean;
  isNationalPark: boolean;
  checklist: string[];
  registrationTemplateText: string;
}

interface TrailIntelligenceBarProps {
  trail: Trail;
  currentUser?: UserProfile | null;
  onRequireLogin?: (actionName: string) => void;
}

/**
 * Returns today's date (YYYY-MM-DD) strictly in Vietnam local timezone (Asia/Ho_Chi_Minh).
 */
function getVietnamLocalDateIso(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(target);
  } catch {
    return new Date(target.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  }
}

export const TrailIntelligenceBar: React.FC<TrailIntelligenceBarProps> = ({
  trail,
  currentUser,
  onRequireLogin,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isTogglingSave, setIsTogglingSave] = useState(false);

  const [offlinePack, setOfflinePack] = useState<OfflineTrailPackRecord | null>(null);
  const [offlineProgress, setOfflineProgress] = useState<number | null>(null);

  const [isTerrain3DOpen, setIsTerrain3DOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);

  // Go/No-Go AI state (Vietnam local timezone default)
  const [showGoNoGo, setShowGoNoGo] = useState(false);
  const [departureDate, setDepartureDate] = useState(() => getVietnamLocalDateIso(0));
  const [goNoGoLoading, setGoNoGoLoading] = useState(false);
  const [goNoGoResult, setGoNoGoResult] = useState<GoNoGoAssessmentData | null>(null);
  const [appliedGoNoGoGear, setAppliedGoNoGoGear] = useState(false);

  // Permit template state
  const [showPermitDrawer, setShowPermitDrawer] = useState(false);
  const [permitLoading, setPermitLoading] = useState(false);
  const [permitData, setPermitData] = useState<PermitTemplateData | null>(null);

  // AbortControllers to eliminate stale trail-switch race conditions
  const goNoGoAbortRef = useRef<AbortController | null>(null);
  const permitAbortRef = useRef<AbortController | null>(null);

  const emitToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
  };

  const [trackedTrailId, setTrackedTrailId] = useState(trail.id);
  const trailMongoId = (trail as Trail & { _id?: string })._id;

  // Reset per-trail drawers cleanly during render when navigating to a different trail (React 19 best practice)
  if (trackedTrailId !== trail.id) {
    setTrackedTrailId(trail.id);
    setGoNoGoResult(null);
    setAppliedGoNoGoGear(false);
    setPermitData(null);
    setPermitLoading(false);
    setShowPermitDrawer(false);
    setShowGoNoGo(false);
  }

  useEffect(() => {
    let active = true;
    goNoGoAbortRef.current?.abort();
    permitAbortRef.current?.abort();

    getOfflineTrailPack(trail.id).then((pack) => {
      if (active) setOfflinePack(pack);
    });

    const token = localStorage.getItem('lost_token');
    if (!token) {
      Promise.resolve().then(() => {
        if (active) setIsSaved(false);
      });
      return () => {
        active = false;
      };
    }

    const savedCtrl = new AbortController();
    fetch('/api/saved-trails', { headers: getApiHeaders(), signal: savedCtrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (json?.success && Array.isArray(json.data)) {
          const found = json.data.some((s: { trailId?: string | { id?: string; _id?: string } }) => {
            const raw = s.trailId;
            const tid = typeof raw === 'object' && raw !== null ? raw.id || raw._id : raw;
            return String(tid) === String(trail.id) || (trailMongoId ? String(tid) === String(trailMongoId) : false);
          });
          setIsSaved(found);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      savedCtrl.abort();
      goNoGoAbortRef.current?.abort();
      permitAbortRef.current?.abort();
    };
  }, [trail.id, trailMongoId]);

  const handleToggleWishlist = async () => {
    if (!currentUser && !localStorage.getItem('lost_token')) {
      onRequireLogin?.('lưu cung đường yêu thích');
      return;
    }
    setIsTogglingSave(true);
    try {
      const res = await fetch(`/api/saved-trails/${encodeURIComponent(trail.id)}`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setIsSaved(Boolean(data.saved));
      emitToast(data.message || (data.saved ? 'Đã lưu cung đường!' : 'Đã bỏ lưu cung đường.'), data.saved ? 'success' : 'info');
    } catch (err: unknown) {
      emitToast(err instanceof Error ? err.message : 'Không thể lưu cung đường lúc này.', 'error');
    } finally {
      setIsTogglingSave(false);
    }
  };

  const handleDownloadOfflinePack = async () => {
    if (offlineProgress !== null) return;
    setOfflineProgress(5);
    try {
      const pack = await downloadOfflineTrailPack(trail, (pct) => setOfflineProgress(pct));
      setOfflinePack(pack);
      setOfflineProgress(null);
      emitToast(`Đã tải Gói Offline (${pack.tileCount} ô bản đồ · ~${pack.estimatedSizeMb} MB)!`, 'success');

      if (localStorage.getItem('lost_token')) {
        fetch(`/api/saved-trails/${encodeURIComponent(trail.id)}`, {
          method: 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ savedOffline: true, forceSave: true }),
        })
          .then((r) => r.ok && setIsSaved(true))
          .catch(() => {});
      }
    } catch (err: unknown) {
      setOfflineProgress(null);
      emitToast(err instanceof Error ? err.message : 'Không thể tải gói bản đồ Offline.', 'error');
    }
  };

  const handleDeleteOfflinePack = async () => {
    try {
      await deleteOfflineTrailPack(trail.id);
      setOfflinePack(null);
      emitToast('Đã xóa gói bản đồ Offline để giải phóng dung lượng.', 'info');
    } catch {
      emitToast('Lỗi khi xóa gói Offline.', 'error');
    }
  };

  const handleRunGoNoGo = async (dateOverride?: string) => {
    const targetDate = dateOverride || departureDate;
    goNoGoAbortRef.current?.abort();
    const ctrl = new AbortController();
    goNoGoAbortRef.current = ctrl;

    setShowGoNoGo(true);
    setGoNoGoLoading(true);
    setAppliedGoNoGoGear(false);
    try {
      const data = await assessGoNoGoApi(trail.id, targetDate, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setGoNoGoResult(data);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      emitToast(err instanceof Error ? err.message : 'Không thể chạy đánh giá Go/No-Go.', 'error');
    } finally {
      if (!ctrl.signal.aborted) {
        setGoNoGoLoading(false);
      }
    }
  };

  const handleOpenPermitTemplate = async () => {
    const nextState = !showPermitDrawer;
    setShowPermitDrawer(nextState);
    if (nextState && !permitData && !permitLoading) {
      permitAbortRef.current?.abort();
      const ctrl = new AbortController();
      permitAbortRef.current = ctrl;
      setPermitLoading(true);
      try {
        const res = await fetch(`/api/trails/${encodeURIComponent(trail.id)}/permit-template`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!ctrl.signal.aborted && json.success && json.data) {
          setPermitData(json.data);
        } else if (!ctrl.signal.aborted) {
          emitToast('Không thể tải mẫu giấy phép VQG lúc này.', 'error');
        }
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          emitToast('Không thể tải mẫu giấy phép VQG lúc này.', 'error');
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setPermitLoading(false);
        }
      }
    }
  };

  const handleApplyDynamicGear = async () => {
    if (!goNoGoResult || goNoGoResult.dynamicGearAdditions.length === 0) return;
    const res = await applyGearItemsToTrailChecklist(
      trail.id,
      trail.name,
      goNoGoResult.dynamicGearAdditions.map((name) => ({
        name,
        weightGrams: 280,
        category: 'Y tế & An toàn',
        isEssential: true,
        reason: `Bổ sung Go/No-Go (${goNoGoResult.departureDate})`,
      }))
    );
    setAppliedGoNoGoGear(true);
    emitToast(
      res.addedCount > 0
        ? `Đã thêm ${res.addedCount} trang bị bổ sung vào Checklist${res.cloudSynced ? ' (đồng bộ đám mây)' : ''}!`
        : 'Các trang bị này đã có sẵn trong Checklist của cung đường.',
      'success'
    );
  };

  const minDateIso = getVietnamLocalDateIso(0);
  const maxForecastIso = getVietnamLocalDateIso(13);

  return (
    <div style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Action Command Strip */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${isSaved ? 'btn-primary' : 'btn-outline'}`}
            onClick={handleToggleWishlist}
            disabled={isTogglingSave}
            style={{ padding: '7px 13px', fontSize: '0.8rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>{isSaved ? 'Đã Lưu Cung' : 'Lưu Cung Đường'}</span>
          </button>

          {offlinePack ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid var(--color-primary)', borderRadius: 4, padding: '6px 10px', fontSize: '0.76rem', color: 'var(--color-primary)', fontWeight: 700 }}>
              <IconCheckCircle size={14} color="var(--color-primary)" />
              <span>Offline Sẵn Sàng ({offlinePack.estimatedSizeMb} MB)</span>
              <button
                type="button"
                onClick={handleDeleteOfflinePack}
                title="Xóa gói offline"
                aria-label="Xóa gói offline"
                style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--color-error))', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <IconTrash size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDownloadOfflinePack}
              disabled={offlineProgress !== null}
              style={{ padding: '7px 13px', fontSize: '0.8rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-sky)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{offlineProgress !== null ? `Đang tải Offline (${offlineProgress}%)...` : 'Tải Gói Offline'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setIsTerrain3DOpen(true)}
            style={{ padding: '7px 13px', fontSize: '0.8rem', borderColor: 'var(--color-border-glow)' }}
          >
            <IconMountain size={14} color="var(--color-primary)" />
            <span>Bản Đồ 3D Địa Hình Thật</span>
          </button>

          <button
            type="button"
            className={`btn ${showGoNoGo ? 'btn-sky' : 'btn-outline'}`}
            onClick={() => {
              if (!showGoNoGo && !goNoGoResult) void handleRunGoNoGo();
              else setShowGoNoGo(!showGoNoGo);
            }}
            style={{ padding: '7px 13px', fontSize: '0.8rem' }}
          >
            <IconSparkles size={14} />
            <span>AI Đánh Giá Go/No-Go</span>
          </button>

          <button
            type="button"
            className={`btn ${showPermitDrawer ? 'btn-earth' : 'btn-outline'}`}
            onClick={handleOpenPermitTemplate}
            style={{ padding: '7px 13px', fontSize: '0.8rem' }}
          >
            <IconFileText size={14} />
            <span>Hồ Sơ Giấy Phép VQG</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setIsSafetyModalOpen(true)}
          style={{ padding: '7px 14px', fontSize: '0.8rem' }}
        >
          <IconShieldAlert size={14} color="var(--color-on-danger)" />
          <span>Báo Bình An &amp; SOS 2G</span>
        </button>
      </div>

      {/* Expandable AI Go / No-Go Expedition Assessment Card */}
      {showGoNoGo && (
        <div
          className="card"
          style={{
            border: '1px solid var(--color-border-strong)',
            borderLeft: `3px solid ${
              goNoGoResult?.verdict === 'NO_GO'
                ? 'var(--color-error)'
                : goNoGoResult?.verdict === 'CAUTION'
                ? 'var(--color-earth)'
                : 'var(--color-primary)'
            }`,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconSparkles size={16} color="var(--color-primary)" />
                <strong className="font-editorial" style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  Phân Tích An Toàn Xuất Phát (Go / No-Go)
                </strong>
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                Dự báo vệ tinh chi tiết 14 ngày ({minDateIso} – {maxForecastIso}) · Hiệu chỉnh nhiệt độ đỉnh &amp; gió rét
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                className="form-input"
                min={minDateIso}
                value={departureDate}
                onChange={(e) => {
                  setDepartureDate(e.target.value);
                  if (e.target.value) void handleRunGoNoGo(e.target.value);
                }}
                style={{ padding: '5px 10px', fontSize: '0.8rem' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleRunGoNoGo()}
                disabled={goNoGoLoading}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                {goNoGoLoading ? 'Đang phân tích...' : 'Chấm Điểm Lại'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  queueAiAssistantPrompt(
                    `Phân tích chi tiết đánh giá Go/No-Go, lịch trình và đồ dùng cho cung ${trail.name} khởi hành ngày ${departureDate}`,
                    trail.id
                  )
                }
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <IconBot size={13} color="var(--color-primary)" />
                <span>Hỏi LOST AI chi tiết</span>
              </button>
            </div>
          </div>

          {goNoGoLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
              Đang tổng hợp thời tiết Open-Meteo {trail.durationDays > 1 ? `(${trail.durationDays} ngày hành trình)` : ''}, nhiệt độ đỉnh {trail.maxAltitudeM}m, sự cố sạt lở và báo cáo thực địa...
            </div>
          ) : goNoGoResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Verdict Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: 'var(--color-bg-main)', padding: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      className={`badge ${
                        goNoGoResult.verdict === 'GO'
                          ? 'badge-success'
                          : goNoGoResult.verdict === 'CAUTION'
                          ? 'badge-warning'
                          : 'badge-error'
                      }`}
                    >
                      {goNoGoResult.verdictLabel}
                    </span>
                    {goNoGoResult.factors?.multiDayCheckedDays && goNoGoResult.factors.multiDayCheckedDays > 1 && (
                      <span className="badge badge-cloud">
                        Quét {goNoGoResult.factors.multiDayCheckedDays} ngày hành trình
                      </span>
                    )}
                    {goNoGoResult.factors?.seaOfCloudsIndex !== null &&
                      goNoGoResult.factors?.seaOfCloudsIndex !== undefined &&
                      trail.maxAltitudeM >= 1800 && (
                        <span className="badge badge-cloud">
                          Chỉ số biển mây: {goNoGoResult.factors.seaOfCloudsIndex}%
                        </span>
                      )}
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: 'var(--color-text-main)', lineHeight: 1.55 }}>
                    {goNoGoResult.advice}
                  </p>
                </div>

                <div style={{ textAlign: 'center', minWidth: 96, padding: '8px 14px', borderRadius: 6, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>ĐIỂM AN TOÀN</div>
                  <div
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                      color:
                        goNoGoResult.verdict === 'GO'
                          ? 'var(--color-primary)'
                          : goNoGoResult.verdict === 'CAUTION'
                          ? 'var(--color-earth)'
                          : 'var(--color-error-text, var(--color-error))',
                    }}
                  >
                    {goNoGoResult.score}/100
                  </div>
                </div>
              </div>

              {/* 3-Factor Score Breakdown */}
              {goNoGoResult.factors && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {[
                    { label: 'Thời tiết & Gió rét', val: goNoGoResult.factors.weatherScore },
                    { label: 'Sự cố & Tình trạng đường', val: goNoGoResult.factors.hazardScore },
                    { label: 'Mùa vụ địa phương', val: goNoGoResult.factors.seasonScore },
                  ].map((f) => (
                    <div key={f.label} style={{ background: 'var(--color-bg-main)', padding: '9px 11px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', marginBottom: 5 }}>
                        <span style={{ color: 'var(--color-text-dim)' }}>{f.label}</span>
                        <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{f.val}/100</strong>
                      </div>
                      <div style={{ height: 5, borderRadius: 2, background: 'var(--color-surface-elevated)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${f.val}%`,
                            height: '100%',
                            background: f.val >= 72 ? 'var(--color-primary)' : f.val >= 45 ? 'var(--color-earth)' : 'var(--color-error)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Telemetry Grid — ALWAYS shows Active Incidents even when weatherSummary is null! */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, fontSize: '0.78rem' }}>
                {goNoGoResult.weatherSummary ? (
                  <>
                    <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem' }}>
                        Nhiệt độ đỉnh (~{trail.maxAltitudeM}m)
                      </div>
                      <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                        {goNoGoResult.weatherSummary.summitTempMinC ?? goNoGoResult.weatherSummary.tempMinC}°C –{' '}
                        {goNoGoResult.weatherSummary.summitTempMaxC ?? goNoGoResult.weatherSummary.tempMaxC}°C
                      </strong>
                      {goNoGoResult.weatherSummary.windChillC !== undefined && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                          Gió rét đêm: ~{goNoGoResult.weatherSummary.windChillC}°C
                        </div>
                      )}
                    </div>
                    <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem' }}>Lượng mưa dự báo</div>
                      <strong style={{ color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                        {goNoGoResult.weatherSummary.precipMm} mm
                      </strong>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                        {goNoGoResult.weatherSummary.conditionLabel}
                      </div>
                    </div>
                    <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem' }}>Gió giật tối đa</div>
                      <strong style={{ color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
                        {goNoGoResult.weatherSummary.windSpeedKmH} km/h
                      </strong>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Độ ẩm {goNoGoResult.weatherSummary.humidityPercent}%
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)', gridColumn: 'span 2' }}>
                    <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem' }}>Dữ liệu dự báo vệ tinh</div>
                    <strong style={{ color: 'var(--color-earth)', fontSize: '0.8rem' }}>
                      {goNoGoResult.factors?.weatherOutOfRange
                        ? 'Ngoài khung dự báo 14 ngày (Đánh giá theo mùa vụ)'
                        : 'Ngoại tuyến — chỉ đánh giá sự cố & mùa vụ'}
                    </strong>
                  </div>
                )}

                <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem' }}>Sự cố đang mở</div>
                  <strong style={{ color: goNoGoResult.activeIncidentsCount > 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {goNoGoResult.activeIncidentsCount} cảnh báo
                  </strong>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                    {goNoGoResult.recentConditions?.length || 0} báo cáo đường gần đây
                  </div>
                </div>
              </div>

              {/* Recent Field Conditions */}
              {goNoGoResult.recentConditions && goNoGoResult.recentConditions.length > 0 && (
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 11, fontSize: '0.79rem' }}>
                  <strong style={{ color: 'var(--color-sky)', display: 'block', marginBottom: 4 }}>
                    Báo cáo tình trạng đường gần nhất từ cộng đồng:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                    {goNoGoResult.recentConditions.map((c, idx) => (
                      <li key={idx}>
                        <strong style={{ color: 'var(--color-text-main)' }}>[{c.status.toUpperCase()}]</strong> {c.note}{' '}
                        <span style={{ color: 'var(--color-text-dim)' }}>({c.reportedAt})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks (Strict Dual-Theme color-mix, ZERO hardcoded rgba!) */}
              {goNoGoResult.risks.length > 0 && (
                <div
                  style={{
                    background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                    borderLeft: '3px solid var(--color-error)',
                    borderRadius: 6,
                    padding: 12,
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ color: 'var(--color-error-text, var(--color-error))', display: 'block', marginBottom: 4 }}>Rủi ro cần lưu ý:</strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-main)', lineHeight: 1.55 }}>
                    {goNoGoResult.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dynamic Gear Additions with 1-Click Apply */}
              {goNoGoResult.dynamicGearAdditions.length > 0 && (
                <div
                  style={{
                    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                    borderLeft: '3px solid var(--color-primary)',
                    borderRadius: 6,
                    padding: 12,
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    <strong style={{ color: 'var(--color-primary)' }}>Trang bị bổ sung theo thời tiết thực tế:</strong>
                    <button
                      type="button"
                      className={`btn ${appliedGoNoGoGear ? 'btn-outline' : 'btn-primary'}`}
                      disabled={appliedGoNoGoGear}
                      onClick={() => void handleApplyDynamicGear()}
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                    >
                      <IconCheckCircle size={12} />
                      <span>{appliedGoNoGoGear ? 'Đã thêm vào Checklist' : 'Thêm vào Checklist cung này'}</span>
                    </button>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-main)', lineHeight: 1.55 }}>
                    {goNoGoResult.dynamicGearAdditions.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Expandable Permit Checklist & Registration Sheet (with Loading State) */}
      {showPermitDrawer && (
        <div className="card" style={{ border: '1px solid var(--color-border-strong)', padding: 18 }}>
          {permitLoading ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
              Đang tải mẫu đơn &amp; thủ tục Ban Quản lý VQG / Trạm Kiểm lâm...
            </div>
          ) : permitData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-earth)', textTransform: 'uppercase' }}>
                    Hồ Sơ Thủ Tục Rừng &amp; Biên Giới Việt Nam
                  </div>
                  <strong style={{ fontSize: '0.96rem', color: 'var(--color-text-main)' }}>
                    Cơ quan tiếp nhận: {permitData.authority}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(permitData.registrationTemplateText);
                        emitToast('Đã sao chép mẫu đơn đăng ký đoàn vào bộ nhớ tạm!', 'success');
                      } catch {
                        emitToast('Không thể tự động sao chép.', 'info');
                      }
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <IconCopy size={13} />
                    <span>Sao Chép Mẫu Đơn</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      const blob = new Blob([permitData.registrationTemplateText], {
                        type: 'text/plain;charset=utf-8',
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Don_Dang_Ky_${trail.id}_LOST.txt`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                      emitToast('Đã tải tệp mẫu đơn đăng ký (.txt)!', 'success');
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <IconDownload size={13} color="var(--color-primary)" />
                    <span>Tải file đơn (.txt)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      window.print();
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    <span>In mẫu đơn</span>
                  </button>
                </div>
              </div>

              <ul style={{ margin: '0 0 12px 0', paddingLeft: 18, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {permitData.checklist.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 6,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-main)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-family)',
                  lineHeight: 1.55,
                }}
              >
                {permitData.registrationTemplateText}
              </pre>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 14, color: 'var(--color-text-dim)', fontSize: '0.82rem' }}>
              Chưa tải được mẫu hồ sơ giấy phép. Vui lòng thử bấm lại.
            </div>
          )}
        </div>
      )}

      {/* Lazy-Loaded Real 3D Terrain WebGL Modal */}
      {isTerrain3DOpen && (
        <Suspense fallback={null}>
          <Terrain3DModal trail={trail} isOpen={isTerrain3DOpen} onClose={() => setIsTerrain3DOpen(false)} />
        </Suspense>
      )}

      {/* Safety Check-in Timer & Offline 2G SOS Modal */}
      {isSafetyModalOpen && (
        <Suspense fallback={null}>
          <SafetyTimerModal
            isOpen={isSafetyModalOpen}
            onClose={() => setIsSafetyModalOpen(false)}
            currentUser={currentUser}
            selectedTrail={trail}
            onShowToast={emitToast}
            onRequireAuth={() => onRequireLogin?.('kích hoạt hẹn giờ báo bình an')}
          />
        </Suspense>
      )}
    </div>
  );
};
