import React, { useState } from 'react';
import {
  IconMountain,
  IconMapPin,
  IconCompass,
  IconShieldAlert,
  IconPhoneCall,
  IconHiking,
  IconCopy,
  IconCheck,
  IconDroplet,
  IconFlame,
  IconClock,
  IconBackpack,
  IconSparkles,
  IconCalendar,
  IconAlertTriangle,
  IconCheckCircle,
} from '../common/SvgIcons.js';
import { buildOfflineSosSmsUri } from '../../utils/geoMath.js';
import { computeClientBioMetrics } from '../../utils/gpxParser.js';
import {
  removeEmojis,
  applyGearItemsToTrailChecklist,
  applyItineraryToTrail,
} from '../../services/aiAssistant.service.js';
import {
  extractPrimaryDialNumber,
  isSafeImageUrl,
  type AiFitnessLevel,
  type BioCalcResult,
  type FirstAidTriageCardData,
  type FuelPlanResult,
  type GoNoGoAssessmentData,
  type GpxAnalysisResult,
  type ItineraryCardData,
  type PacePlanResult,
  type RankedTrailCardItem,
  type ReadinessAuditResult,
  type RichAiAction,
  type StructuredGearCategory,
  type TrailCompareData,
} from './ai.types.js';

interface AiRichCardsProps {
  messageId: string;
  action: RichAiAction;
  actionIndex: number;
  currentTrailId?: string;
  currentTrailName?: string;
  /** Strictly genuine hardware GPS fix from navigator.geolocation — NEVER a hardcoded city fallback. */
  userCoords?: { lat: number; lng: number } | null;
  gpsStatus?: 'idle' | 'acquiring' | 'acquired' | 'unavailable';
  checkedGearItems: Record<string, boolean>;
  copiedId: string | null;
  onToggleGearCheck: (key: string) => void;
  onCopyText: (id: string, text: string) => void | boolean | Promise<boolean | void>;
  onSelectTrail?: (trailId: string) => void;
  onCloseModal?: () => void;
  onSendQuickPrompt: (text: string) => void;
  onToast: (msg: string) => void;
}

/* =========================================================================
 * Interactive Bio-Calculator Sub-Card (Live Naismith + Tobler Sliders)
 * ========================================================================= */
const InteractiveBioCalcCard: React.FC<{ initialData: BioCalcResult }> = ({ initialData }) => {
  const [bodyKg, setBodyKg] = useState(initialData.inputs.bodyWeightKg);
  const [packKg, setPackKg] = useState(initialData.inputs.packWeightKg);
  const [fitness, setFitness] = useState<AiFitnessLevel>(initialData.inputs.fitnessLevel);

  const live = computeClientBioMetrics({
    trailName: initialData.inputs.trailName,
    distanceKm: initialData.inputs.distanceKm,
    elevationGainM: initialData.inputs.elevationGainM,
    elevationLossM: initialData.inputs.elevationLossM,
    maxAltitudeM: initialData.inputs.maxAltitudeM,
    bodyWeightKg: bodyKg,
    packWeightKg: packKg,
    fitnessLevel: fitness,
    ambientTempC: initialData.inputs.ambientTempC,
    durationDays: initialData.inputs.durationDays,
  });

  const packColor =
    live.packStatus === 'overweight'
      ? 'var(--color-error-text, var(--color-error))'
      : live.packStatus === 'caution'
      ? 'var(--color-earth)'
      : 'var(--color-primary)';

  return (
    <div
      style={{
        marginTop: 8,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        borderLeft: '3px solid var(--color-primary)',
        borderRadius: 6,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.8rem' }}>
          <IconClock size={14} color="var(--color-primary)" />
          <span>Ước tính giờ đi, nước &amp; tải balo (Naismith &amp; Tobler)</span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {live.inputs.distanceKm} km · +{live.inputs.elevationGainM}m · Đỉnh {live.inputs.maxAltitudeM}m
        </span>
      </div>

      {/* Inline Interactive Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, background: 'var(--color-bg-main)', padding: 10, borderRadius: 4, border: '1px solid var(--color-border)' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          <span>Cân nặng: <strong style={{ color: 'var(--color-text-main)' }}>{bodyKg} kg</strong></span>
          <input
            type="range"
            min={40}
            max={120}
            value={bodyKg}
            onChange={(e) => setBodyKg(Number(e.target.value))}
            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          <span>Balo: <strong style={{ color: packColor }}>{packKg} kg ({live.packRatioPercent}%)</strong></span>
          <input
            type="range"
            min={2}
            max={24}
            step={0.5}
            value={packKg}
            onChange={(e) => setPackKg(Number(e.target.value))}
            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          <span>Thể lực:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(
              [
                { id: 'beginner', label: 'Mới' },
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
                  padding: '3px 4px',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: fitness === lvl.id ? 'var(--color-primary)' : 'var(--color-bg-card)',
                  color: fitness === lvl.id ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Telemetry Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
        <div style={{ background: 'var(--color-bg-main)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconClock size={11} color="var(--color-primary)" /> Di chuyển
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {live.recommendedMovingHours}h
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
            Tổng gồm nghỉ: ~{live.estimatedTotalTripHours}h
          </div>
        </div>

        <div style={{ background: 'var(--color-bg-main)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconDroplet size={11} color="var(--color-sky)" /> Nước &amp; Oresol
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
            {live.waterLitersTotal} L
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
            {live.waterLitersPerDay}L/ngày · {live.oresolPackets} gói Oresol
          </div>
        </div>

        <div style={{ background: 'var(--color-bg-main)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconFlame size={11} color="var(--color-earth)" /> Năng lượng
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
            {live.caloriesActiveKcal.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>kcal vận động</div>
        </div>

        <div style={{ background: 'var(--color-bg-main)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconBackpack size={11} color={packColor} /> Tải balo
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: packColor, fontVariantNumeric: 'tabular-nums' }}>
            {live.packRatioPercent}%
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
            Naismith {live.naismithHours}h / Tobler {live.toblerHours}h
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.5, background: 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-main))', padding: '7px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
        <strong style={{ color: packColor }}>{live.packAdvice}</strong> {live.amsAdvice}
      </div>
    </div>
  );
};

/* =========================================================================
 * GPX Elevation Sparkline SVG Card (Pure SVG, Dual-Theme Tokens)
 * ========================================================================= */
const GpxAnalysisCard: React.FC<{
  gpx: GpxAnalysisResult;
  onSelectTrail?: (trailId: string) => void;
  onCloseModal?: () => void;
}> = ({ gpx, onSelectTrail, onCloseModal }) => {
  const width = 420;
  const height = 104;
  const padX = 8;
  const padY = 12;

  const pts = gpx.elevationProfile;
  const minE = Math.min(...pts.map((p) => p.elevationM), gpx.minAltitudeM);
  const maxE = Math.max(...pts.map((p) => p.elevationM), gpx.maxAltitudeM, minE + 20);
  const maxD = Math.max(pts[pts.length - 1]?.distanceKm || 1, 0.1);

  const toX = (d: number) => padX + (d / maxD) * (width - padX * 2);
  const toY = (e: number) => height - padY - ((e - minE) / (maxE - minE)) * (height - padY * 2);

  const areaPath =
    pts.length >= 2
      ? `M ${toX(pts[0].distanceKm)} ${height - padY} ` +
        pts.map((p) => `L ${toX(p.distanceKm).toFixed(1)} ${toY(p.elevationM).toFixed(1)}`).join(' ') +
        ` L ${toX(pts[pts.length - 1].distanceKm)} ${height - padY} Z`
      : '';

  return (
    <div
      style={{
        marginTop: 8,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        borderLeft: '3px solid var(--color-sky)',
        borderRadius: 6,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-sky)' }}>
          <IconMountain size={14} color="var(--color-sky)" />
          <span>Đọc file GPX: {gpx.fileName}</span>
        </div>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            background: 'color-mix(in srgb, var(--color-earth) 14%, transparent)',
            color: 'var(--color-earth)',
            border: '1px solid color-mix(in srgb, var(--color-earth) 35%, transparent)',
          }}
        >
          Độ khó ~{gpx.estimatedDifficulty}/5
        </span>
      </div>

      {/* Pure SVG Slope-Colored Elevation Profile */}
      {pts.length >= 2 && (
        <div style={{ background: 'var(--color-bg-main)', borderRadius: 4, border: '1px solid var(--color-border)', padding: '6px 8px' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            role="img"
            aria-label="Biểu đồ cao độ GPX"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          >
            <path d={areaPath} fill="var(--color-sky)" fillOpacity="0.12" />
            {pts.slice(1).map((p, idx) => {
              const prev = pts[idx];
              const absSlope = Math.abs(p.slopePercent);
              const strokeColor =
                absSlope >= 20 ? 'var(--color-error)' : absSlope >= 12 ? 'var(--color-earth)' : 'var(--color-primary)';
              return (
                <line
                  key={idx}
                  x1={toX(prev.distanceKm)}
                  y1={toY(prev.elevationM)}
                  x2={toX(p.distanceKm)}
                  y2={toY(p.elevationM)}
                  stroke={strokeColor}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            <span>0 km · Thấp nhất {gpx.minAltitudeM}m</span>
            <span>Cao nhất {gpx.maxAltitudeM}m · Dốc cực đại {gpx.maxSlopePercent}%</span>
            <span>{gpx.distanceKm} km</span>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {[
          { label: 'Cự ly', val: `${gpx.distanceKm} km`, color: 'var(--color-text-main)' },
          { label: 'Leo / Hạ', val: `+${gpx.elevationGainM}m`, color: 'var(--color-primary)' },
          { label: 'ETA Naismith', val: `${gpx.bioMetrics.recommendedMovingHours}h`, color: 'var(--color-sky)' },
          { label: 'Nước uống', val: `${gpx.bioMetrics.waterLitersTotal} L`, color: 'var(--color-earth)' },
        ].map((m) => (
          <div key={m.label} style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>{m.label}</div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Weather at Trailhead Start */}
      {gpx.weatherAtStart && (
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '6px 9px',
            fontSize: '0.73rem',
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <strong style={{ color: 'var(--color-text-main)' }}>Thời tiết điểm xuất phát:</strong>{' '}
          {gpx.weatherAtStart.tempMinC}°C – {gpx.weatherAtStart.tempMaxC}°C · Mưa {gpx.weatherAtStart.precipMm} mm · Gió{' '}
          {gpx.weatherAtStart.windSpeedKmH} km/h ({gpx.weatherAtStart.conditionLabel})
        </div>
      )}

      {/* Warnings */}
      {gpx.safetyWarnings.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {gpx.safetyWarnings.map((w, idx) => (
            <li key={idx}>{w}</li>
          ))}
        </ul>
      )}

      {gpx.nearestTrail && onSelectTrail && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
            Gần tuyến LOST: <strong style={{ color: 'var(--color-text-main)' }}>{gpx.nearestTrail.name}</strong> ({gpx.nearestTrail.distanceFromStartKm} km)
          </span>
          <button
            type="button"
            onClick={() => {
              onSelectTrail(gpx.nearestTrail!.id);
              onCloseModal?.();
            }}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Mở cung đường
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
 * Main AiRichCards Switcher
 * ========================================================================= */
export const AiRichCards: React.FC<AiRichCardsProps> = ({
  messageId,
  action,
  actionIndex,
  currentTrailId,
  currentTrailName,
  userCoords,
  gpsStatus,
  checkedGearItems,
  copiedId,
  onToggleGearCheck,
  onCopyText,
  onSelectTrail,
  onCloseModal,
  onSendQuickPrompt,
  onToast,
}) => {
  const [appliedGear, setAppliedGear] = useState(false);
  const [appliedItinerary, setAppliedItinerary] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // 1. Ranked Trail Recommendations Card
  if (action.type === 'ranked_trails' && Array.isArray(action.rankedTrails) && action.rankedTrails.length > 0) {
    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {action.rankedTrails.map((t: RankedTrailCardItem, idx: number) => {
          const seasonBgColor =
            t.seasonStatus === 'ideal'
              ? 'var(--color-primary)'
              : t.seasonStatus === 'avoid'
              ? 'var(--color-error)'
              : 'var(--color-sky)';
          const seasonTextColor =
            t.seasonStatus === 'ideal'
              ? 'var(--color-primary)'
              : t.seasonStatus === 'avoid'
              ? 'var(--color-error-text, var(--color-error))'
              : 'var(--color-sky)';
          const seasonLabel =
            t.seasonStatus === 'ideal' ? 'Đang mùa đẹp' : t.seasonStatus === 'avoid' ? 'Mùa mưa/tránh' : 'Đi được';
          const imgKey = `ranked-${t.id || idx}`;
          const canShowCover = isSafeImageUrl(t.coverImage) && !failedImages[imgKey];

          return (
            <div
              key={t.id || idx}
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                {canShowCover ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={t.coverImage}
                    alt={t.name}
                    onError={() => setFailedImages((prev) => ({ ...prev, [imgKey]: true }))}
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
                    <IconMountain size={24} color="var(--color-primary)" />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      #{idx + 1} {t.name}
                    </h4>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                        color: 'var(--color-primary)',
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {t.matchScore}% khớp
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <IconMapPin size={10} /> {t.province}
                    </span>
                    <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)', fontWeight: 700 }}>
                      {t.maxAltitudeM.toLocaleString('vi-VN')}m
                    </span>
                    <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)', color: 'var(--color-sky)', fontWeight: 600 }}>
                      {t.distanceKm} km · Cấp {t.difficultyLevel}/5
                    </span>
                    <span style={{ fontSize: '0.69rem', padding: '2px 6px', borderRadius: 4, background: `color-mix(in srgb, ${seasonBgColor} 12%, transparent)`, color: seasonTextColor, fontWeight: 700 }}>
                      {seasonLabel}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', lineHeight: 1.4 }}>
                    {t.matchReasons.join(' · ')}
                  </div>
                </div>
              </div>

              <div style={{ padding: '7px 10px', background: 'var(--color-bg-main)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => onSendQuickPrompt(`Hôm nay có nên leo ${t.name} không (Go/No-Go)?`)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-strong)',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconSparkles size={11} color="var(--color-sky)" />
                  <span>Go/No-Go</span>
                </button>

                {onSelectTrail && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTrail(t.id);
                      onCloseModal?.();
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <IconCompass size={12} color="var(--color-on-primary)" />
                    <span>Mở bản đồ 3D</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 2. Single Trail Showcase Card (Backwards-compatible)
  if (action.type === 'trail_card' && action.trailData) {
    const t = action.trailData;
    const singleImgKey = `single-${action.trailId || t.name || 'trail'}`;
    const canShowSingleCover = isSafeImageUrl(t.coverImage) && !failedImages[singleImgKey];
    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-glow)',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          {canShowSingleCover ? (
            <img
              loading="lazy"
              decoding="async"
              src={t.coverImage}
              alt={t.name || 'Cung đường'}
              onError={() => setFailedImages((prev) => ({ ...prev, [singleImgKey]: true }))}
              style={{ width: 68, height: 68, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border)' }}
            />
          ) : (
            <div style={{ width: 68, height: 68, borderRadius: 4, background: 'var(--color-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconMountain size={24} color="var(--color-primary)" />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.35 }}>
              {t.name}
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              <span style={{ fontSize: '0.7rem', background: 'var(--color-surface-elevated)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IconMapPin size={10} /> {t.province}
              </span>
              <span style={{ fontSize: '0.7rem', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-primary)', fontWeight: 700 }}>
                {t.maxAltitudeM}m
              </span>
              <span style={{ fontSize: '0.7rem', background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-sky)', fontWeight: 600 }}>
                {t.distanceKm} km
              </span>
            </div>
          </div>
        </div>

        {onSelectTrail && action.trailId && (
          <div style={{ padding: '7px 10px', background: 'var(--color-bg-main)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>Độ khó: {t.difficultyLevel}/5</span>
            <button
              type="button"
              onClick={() => {
                onSelectTrail(action.trailId!);
                onCloseModal?.();
              }}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                borderRadius: 4,
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <IconCompass size={12} color="var(--color-on-primary)" />
              <span>Mở trên bản đồ 3D</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. Interactive Bio-Calculator Card
  if (action.type === 'bio_calculator' && action.bioCalcData) {
    return <InteractiveBioCalcCard initialData={action.bioCalcData} />;
  }

  // 4. GPX Analysis Card
  if (action.type === 'gpx_analysis_card' && action.gpxData) {
    return <GpxAnalysisCard gpx={action.gpxData} onSelectTrail={onSelectTrail} onCloseModal={onCloseModal} />;
  }

  // 5. Wilderness First Aid Triage & SOS Card
  if (action.type === 'first_aid_triage' && action.triageData) {
    const tri: FirstAidTriageCardData = action.triageData;
    const accent = tri.severity === 'critical' ? 'var(--color-error)' : 'var(--color-earth)';
    const accentText = tri.severity === 'critical' ? 'var(--color-error-text, var(--color-error))' : 'var(--color-earth)';
    const badgeFg = tri.severity === 'critical' ? 'var(--color-on-danger)' : 'var(--color-on-primary)';
    const primaryDial = extractPrimaryDialNumber(tri.emergencyContacts[0]?.dialNumber || tri.emergencyContacts[0]?.phone || '112');
    const smsPacket = buildOfflineSosSmsUri({
      phone: primaryDial,
      trailName: currentTrailName,
      lat: userCoords?.lat,
      lng: userCoords?.lng,
      note: tri.sosSmsNote,
    });

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: `1.5px solid ${accent}`,
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accentText }}>
            <IconShieldAlert size={16} color={accentText} />
            <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {tri.conditionTitle}
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 4,
              background: accent,
              color: badgeFg,
            }}
          >
            {tri.conditionCode}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{tri.summary}</p>

        {/* Immediate Do Steps */}
        <div style={{ background: 'var(--color-bg-main)', padding: '9px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 4 }}>
            Cần làm ngay:
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, fontSize: '0.76rem', color: 'var(--color-text-main)', lineHeight: 1.55 }}>
            {tri.immediateSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        {/* Forbidden Actions */}
        {tri.forbiddenActions.length > 0 && (
          <div style={{ background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))', padding: '8px 10px', borderRadius: 4, border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-error-text, var(--color-error))', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconAlertTriangle size={12} color="var(--color-error-text, var(--color-error))" />
              <span>Tuyệt đối không làm:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
              {tri.forbiddenActions.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* When to Evacuate / Call Emergency Immediately */}
        {Array.isArray(tri.whenToEvacuate) && tri.whenToEvacuate.length > 0 && (
          <div
            style={{
              background: 'color-mix(in srgb, var(--color-earth) 11%, var(--color-bg-main))',
              padding: '8px 10px',
              borderRadius: 4,
              border: '1px solid color-mix(in srgb, var(--color-earth) 38%, transparent)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-earth)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconShieldAlert size={12} color="var(--color-earth)" />
              <span>Khi nào cần gọi cứu hộ / rời tuyến ngay:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
              {tri.whenToEvacuate.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Hardware GPS Fix Verification Banner (NEVER sends fake city coordinates!) */}
        {userCoords ? (
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--color-primary)',
              background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-main))',
              border: '1px solid color-mix(in srgb, var(--color-primary) 32%, transparent)',
              borderRadius: 4,
              padding: '5px 8px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Đã khóa tọa độ GPS thiết bị: <strong>{userCoords.lat.toFixed(5)}, {userCoords.lng.toFixed(5)}</strong> (tự động chèn vào tin nhắn SOS 2G)
          </div>
        ) : (
          <div
            role="status"
            style={{
              fontSize: '0.71rem',
              color: 'var(--color-earth)',
              background: 'color-mix(in srgb, var(--color-earth) 12%, var(--color-bg-main))',
              border: '1px solid color-mix(in srgb, var(--color-earth) 40%, transparent)',
              borderRadius: 4,
              padding: '6px 9px',
              lineHeight: 1.45,
            }}
          >
            <strong>{gpsStatus === 'acquiring' ? 'Đang dò tín hiệu GPS từ thiết bị...' : 'Chưa lấy được tọa độ GPS từ thiết bị.'}</strong>{' '}
            Tin nhắn SOS 2G sẽ không chèn tọa độ giả — bạn nhớ bật Định vị (GPS) trên máy hoặc tự ghi rõ mốc đường / độ cao hiện tại trước khi bấm gửi nhé!
          </div>
        )}

        {/* Offline 2G SOS SMS Action */}
        <a
          href={smsPacket.uri}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 4,
            background: 'var(--color-error)',
            color: 'var(--color-on-danger)',
            fontSize: '0.78rem',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          <IconShieldAlert size={14} color="var(--color-on-danger)" />
          <span>{userCoords ? `Soạn tin nhắn SOS 2G kèm GPS thật (${primaryDial})` : `Soạn tin nhắn SOS 2G khẩn cấp (${primaryDial})`}</span>
        </a>

        {/* Verified Vietnam Emergency Hotlines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {tri.emergencyContacts.map((c, idx) => {
            const dial = extractPrimaryDialNumber(c.dialNumber || c.phone);
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 9px',
                  background: 'var(--color-bg-main)',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{removeEmojis(c.name)}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>{removeEmojis(c.address || c.region || '')}</div>
                </div>
                <a
                  href={`tel:${dial}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--color-error)',
                    color: 'var(--color-on-danger)',
                    padding: '4px 9px',
                    borderRadius: 4,
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <IconPhoneCall size={11} color="var(--color-on-danger)" />
                  {c.phone}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. Legacy Emergency SOS Card (Hardened tel: extraction & Dual-Theme tokens)
  if (action.type === 'emergency_sos' && action.emergencyContacts) {
    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1.5px solid var(--color-error)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--color-error-text, var(--color-error))' }}>
          <IconShieldAlert size={15} color="var(--color-error-text, var(--color-error))" />
          <strong style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>Đường dây nóng cứu hộ xác thực</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {action.emergencyContacts.map((contact, cIdx) => {
            const dial = extractPrimaryDialNumber(contact.dialNumber || contact.phone);
            return (
              <div
                key={cIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 9px',
                  background: 'var(--color-bg-main)',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{removeEmojis(contact.name)}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>{removeEmojis(contact.address || contact.region || '')}</div>
                </div>
                <a
                  href={`tel:${dial}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--color-error)',
                    color: 'var(--color-on-danger)',
                    padding: '4px 9px',
                    borderRadius: 4,
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <IconPhoneCall size={11} color="var(--color-on-danger)" />
                  {contact.phone}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 7. Go/No-Go Breakdown Card inside AI Chat
  if (action.type === 'go_no_go_card' && action.goNoGoData) {
    const g: GoNoGoAssessmentData = action.goNoGoData;
    const verdictBorderColor =
      g.verdict === 'GO' ? 'var(--color-primary)' : g.verdict === 'CAUTION' ? 'var(--color-earth)' : 'var(--color-error)';
    const verdictTextColor =
      g.verdict === 'GO'
        ? 'var(--color-primary)'
        : g.verdict === 'CAUTION'
        ? 'var(--color-earth)'
        : 'var(--color-error-text, var(--color-error))';
    const targetTid = g.trailId || currentTrailId;
    const windChillC = g.weatherSummary?.windChillC ?? g.factors?.windChillC ?? null;
    const seaOfCloudsIndex = g.weatherSummary?.seaOfCloudsIndex ?? g.factors?.seaOfCloudsIndex ?? null;

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderLeft: `3px solid ${verdictBorderColor}`,
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 4,
                background: `color-mix(in srgb, ${verdictBorderColor} 15%, transparent)`,
                color: verdictTextColor,
                border: `1px solid color-mix(in srgb, ${verdictBorderColor} 38%, transparent)`,
              }}
            >
              {g.verdictLabel}
            </span>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-main)', marginTop: 4 }}>
              {g.trailName} · {g.departureDate}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '5px 10px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>ĐIỂM</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: verdictTextColor, fontVariantNumeric: 'tabular-nums' }}>
              {g.score}/100
            </div>
          </div>
        </div>

        {/* Factor Bars */}
        {g.factors && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {[
              { label: 'Thời tiết', score: g.factors.weatherScore },
              { label: 'Đường rừng', score: g.factors.hazardScore },
              { label: 'Mùa vụ', score: g.factors.seasonScore },
            ].map((f) => (
              <div key={f.label} style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-dim)', marginBottom: 4 }}>
                  <span>{f.label}</span>
                  <strong style={{ color: 'var(--color-text-main)' }}>{f.score}</strong>
                </div>
                <div style={{ height: 4, background: 'var(--color-surface-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${f.score}%`, height: '100%', background: f.score >= 70 ? 'var(--color-primary)' : f.score >= 45 ? 'var(--color-earth)' : 'var(--color-error)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Telemetry */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 6, fontSize: '0.73rem' }}>
          {g.weatherSummary && (
            <>
              <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ color: 'var(--color-text-dim)', fontSize: '0.66rem' }}>Đỉnh (ước tính)</div>
                <strong style={{ color: 'var(--color-text-main)' }}>
                  {g.weatherSummary.summitTempMinC ?? g.weatherSummary.tempMinC}°C – {g.weatherSummary.summitTempMaxC ?? g.weatherSummary.tempMaxC}°C
                </strong>
                {typeof windChillC === 'number' && Number.isFinite(windChillC) && (
                  <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
                    Cảm nhận gió rét: {windChillC}°C
                  </div>
                )}
              </div>
              <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ color: 'var(--color-text-dim)', fontSize: '0.66rem' }}>Mưa / gió</div>
                <strong style={{ color: 'var(--color-sky)' }}>
                  {g.weatherSummary.precipMm}mm · {g.weatherSummary.windSpeedKmH} km/h
                </strong>
              </div>
            </>
          )}
          {typeof seaOfCloudsIndex === 'number' && Number.isFinite(seaOfCloudsIndex) && (
            <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <div style={{ color: 'var(--color-text-dim)', fontSize: '0.66rem' }}>Khả năng săn mây</div>
              <strong style={{ color: seaOfCloudsIndex >= 65 ? 'var(--color-primary)' : 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(seaOfCloudsIndex)}%
              </strong>
            </div>
          )}
          <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.66rem' }}>Sự cố mở</div>
            <strong style={{ color: g.activeIncidentsCount > 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)' }}>
              {g.activeIncidentsCount} cảnh báo
            </strong>
          </div>
        </div>

        {/* Risks */}
        {Array.isArray(g.risks) && g.risks.length > 0 && (
          <div
            style={{
              background: 'color-mix(in srgb, var(--color-earth) 9%, var(--color-bg-main))',
              border: '1px solid color-mix(in srgb, var(--color-earth) 32%, transparent)',
              borderRadius: 4,
              padding: '7px 9px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div style={{ fontSize: '0.69rem', fontWeight: 800, color: 'var(--color-earth)' }}>
              Rủi ro cần lưu ý:
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.73rem', color: 'var(--color-text-main)', lineHeight: 1.45 }}>
              {g.risks.map((risk, rIdx) => (
                <li key={rIdx}>{risk}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Advice */}
        {g.advice && (
          <div
            style={{
              fontSize: '0.74rem',
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '7px 9px',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--color-text-main)' }}>Lời khuyên:</strong> {g.advice}
          </div>
        )}

        {g.dynamicGearAdditions.length > 0 && targetTid && (
          <button
            type="button"
            disabled={appliedGear}
            onClick={async () => {
              const res = await applyGearItemsToTrailChecklist(
                targetTid,
                g.trailName,
                g.dynamicGearAdditions.map((name) => ({ name, weightGrams: 280, isEssential: true, reason: `Go/No-Go ${g.departureDate}` }))
              );
              setAppliedGear(true);
              onToast(
                res.addedCount > 0
                  ? `Đã thêm ${res.addedCount} món bổ sung vào Checklist ${g.trailName}!`
                  : 'Các món này đã có sẵn trong Checklist cung đường.'
              );
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              background: appliedGear ? 'var(--color-surface-elevated)' : 'var(--color-primary)',
              color: appliedGear ? 'var(--color-primary)' : 'var(--color-on-primary)',
              border: appliedGear ? '1px solid var(--color-primary)' : 'none',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: appliedGear ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <IconCheckCircle size={13} />
            <span>{appliedGear ? 'Đã đồng bộ vào Checklist cung đường' : `Áp dụng ${g.dynamicGearAdditions.length} đồ bổ sung vào Checklist`}</span>
          </button>
        )}
      </div>
    );
  }

  // 8. Gear Checklist Card (Message-scoped checkboxes + 1-Click Apply)
  if (action.type === 'gear_checklist' && action.checklistItems) {
    const categories: StructuredGearCategory[] = action.checklistItems;
    const targetTid = action.trailId || currentTrailId;
    const targetTName = action.trailName || currentTrailName || 'Cung đường';

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-sky)', fontSize: '0.78rem', fontWeight: 700 }}>
            <IconHiking size={14} color="var(--color-sky)" />
            <span>Danh sách đồ mang theo (đánh dấu món đã xếp)</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                const fullText = categories
                  .map(
                    (c) =>
                      `${removeEmojis(c.category)}:\n` +
                      c.items.map((it) => `- [ ] ${removeEmojis(typeof it === 'string' ? it : it.name)}`).join('\n')
                  )
                  .join('\n\n');
                onCopyText(`${messageId}-gear-${actionIndex}`, fullText);
              }}
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {copiedId === `${messageId}-gear-${actionIndex}` ? (
                <>
                  <IconCheck size={11} color="var(--color-primary)" /> Đã chép
                </>
              ) : (
                <>
                  <IconCopy size={11} /> Sao chép
                </>
              )}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map((cat, catIdx) => (
            <div key={catIdx}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {removeEmojis(cat.category)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cat.items.map((rawItem, itemIdx) => {
                  const name = typeof rawItem === 'string' ? rawItem : rawItem.name;
                  const weight = typeof rawItem === 'string' ? undefined : rawItem.weightGrams;
                  // Scoped uniquely by messageId + actionIndex so checklists never collide!
                  const key = `${messageId}-${actionIndex}-${catIdx}-${itemIdx}`;
                  const isChecked = !!checkedGearItems[key];
                  return (
                    <label
                      key={itemIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: '0.77rem',
                        color: isChecked ? 'var(--color-text-dim)' : 'var(--color-text-main)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleGearCheck(key)}
                          style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                        />
                        <span>{removeEmojis(name)}</span>
                      </span>
                      {weight !== undefined && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {weight}g
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {targetTid && (
          <button
            type="button"
            disabled={appliedGear}
            onClick={async () => {
              const flat = categories.flatMap((c) =>
                c.items.map((it) =>
                  typeof it === 'string'
                    ? { name: it, weightGrams: 250, category: 'Trang phục', isEssential: true }
                    : { name: it.name, weightGrams: it.weightGrams, category: it.targetCategory, isEssential: it.isEssential, reason: it.reason }
                )
              );
              const res = await applyGearItemsToTrailChecklist(targetTid, targetTName, flat);
              setAppliedGear(true);
              onToast(
                res.addedCount > 0
                  ? `Đã áp dụng ${res.addedCount} món vào Checklist ${targetTName}${res.cloudSynced ? ' (đã đồng bộ đám mây)' : ''}!`
                  : `Checklist ${targetTName} đã chứa đầy đủ các món này.`
              );
            }}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 4,
              background: appliedGear ? 'var(--color-surface-elevated)' : 'var(--color-primary)',
              color: appliedGear ? 'var(--color-primary)' : 'var(--color-on-primary)',
              border: appliedGear ? '1px solid var(--color-primary)' : 'none',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: appliedGear ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <IconCheckCircle size={13} />
            <span>{appliedGear ? 'Đã áp dụng vào Checklist cung đường' : `Áp dụng vào Checklist ${targetTName}`}</span>
          </button>
        )}
      </div>
    );
  }

  // 9. Structured Itinerary Card (with 1-Click Apply)
  if (action.type === 'itinerary_card' && action.itineraryData) {
    const itin: ItineraryCardData = action.itineraryData;
    const targetTid = itin.trailId || currentTrailId;

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderLeft: '3px solid var(--color-earth)',
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-earth)', fontSize: '0.79rem', fontWeight: 800 }}>
            <IconCalendar size={14} color="var(--color-earth)" />
            <span>Lịch trình: {itin.trailName}</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>{itin.durationLabel}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {itin.steps.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: 'var(--color-earth)',
                  whiteSpace: 'nowrap',
                  minWidth: 74,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                N{s.day} · {s.time}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{s.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>{s.description}</div>
              </div>
            </div>
          ))}
        </div>

        {targetTid && (
          <button
            type="button"
            disabled={appliedItinerary}
            onClick={() => {
              applyItineraryToTrail(targetTid, `Lịch trình ${itin.trailName} (LOST AI)`, itin.steps);
              setAppliedItinerary(true);
              onToast(`Đã áp dụng ${itin.steps.length} chặng vào tab Lịch Trình của ${itin.trailName}!`);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 4,
              background: appliedItinerary ? 'var(--color-surface-elevated)' : 'var(--color-earth)',
              color: appliedItinerary ? 'var(--color-earth)' : 'var(--color-on-primary)',
              border: appliedItinerary ? '1px solid var(--color-earth)' : 'none',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: appliedItinerary ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <IconCheckCircle size={13} />
            <span>{appliedItinerary ? 'Đã áp dụng vào Lịch trình cung đường' : 'Áp dụng vào Lịch trình cung đường'}</span>
          </button>
        )}
      </div>
    );
  }

  // 9.5. Head-to-Head Multi-Trail Comparison Matrix Card (Wave 4C)
  if (action.type === 'trail_compare_card' && action.compareData && action.compareData.trails.length >= 2) {
    const cmp: TrailCompareData = action.compareData;
    const trails = cmp.trails;
    const maxAlt = Math.max(...trails.map((t) => t.maxAltitudeM));
    const minDiff = Math.min(...trails.map((t) => t.difficultyLevel));
    const formatVndShort = (v: number) => `${(v / 1_000_000).toFixed(1).replace('.0', '')}tr`;

    const rows: Array<{
      label: string;
      render: (t: TrailCompareData['trails'][number]) => React.ReactNode;
      highlight?: (t: TrailCompareData['trails'][number]) => 'primary' | 'error' | null;
    }> = [
      {
        label: 'Tỉnh / Vùng',
        render: (t) => (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{t.province}</div>
            <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)' }}>{t.region}</div>
          </div>
        ),
      },
      {
        label: 'Cao độ đỉnh',
        render: (t) => <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{t.maxAltitudeM.toLocaleString()} m</strong>,
        highlight: (t) => (t.maxAltitudeM === maxAlt ? 'primary' : null),
      },
      {
        label: 'Cự ly / Độ dốc',
        render: (t) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            <strong>{t.distanceKm} km</strong> · +{t.elevationGainM.toLocaleString()}m
          </span>
        ),
      },
      {
        label: 'Độ khó',
        render: (t) => (
          <span style={{ fontWeight: 700 }}>
            Cấp {t.difficultyLevel}/5
          </span>
        ),
        highlight: (t) => (t.difficultyLevel === minDiff ? 'primary' : null),
      },
      {
        label: 'Thời lượng & Naismith',
        render: (t) => (
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontWeight: 700 }}>{t.durationLabel}</div>
            <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)' }}>~{t.naismithHours}h leo · {t.waterLitersTotal}L nước</div>
          </div>
        ),
      },
      {
        label: 'Nguồn nước',
        render: (t) => (
          <span style={{ color: t.hasWaterSource ? 'var(--color-primary)' : 'var(--color-earth)', fontWeight: 700 }}>
            {t.hasWaterSource ? 'Có suối dọc đường' : 'Khô / Tự mang đủ'}
          </span>
        ),
      },
      {
        label: 'Giấy phép VQG',
        render: (t) => (
          <span style={{ color: t.permitRequired ? 'var(--color-earth)' : 'var(--color-primary)', fontWeight: 600 }}>
            {t.permitRequired ? 'Cần đăng ký VQG' : 'Tự do (CCCD)'}
          </span>
        ),
      },
      {
        label: `Mùa vụ (Tháng ${cmp.targetMonth})`,
        render: (t) => (
          <div>
            <span
              style={{
                fontWeight: 700,
                color:
                  t.seasonStatus === 'ideal'
                    ? 'var(--color-primary)'
                    : t.seasonStatus === 'avoid'
                    ? 'var(--color-error-text, var(--color-error))'
                    : 'var(--color-earth)',
              }}
            >
              {t.seasonStatus === 'ideal' ? 'Mùa đẹp nhất' : t.seasonStatus === 'avoid' ? 'Mùa mưa/khắc nghiệt' : 'Chuyển tiếp'}
            </span>
            <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
              Đẹp: T{t.bestMonths.slice(0, 6).join(', ')}
            </div>
          </div>
        ),
        highlight: (t) => (t.seasonStatus === 'ideal' ? 'primary' : t.seasonStatus === 'avoid' ? 'error' : null),
      },
      {
        label: 'Sự cố thực địa',
        render: (t) => (
          <span style={{ fontWeight: 700, color: t.activeIncidentsCount > 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)' }}>
            {t.activeIncidentsCount > 0 ? `${t.activeIncidentsCount} cảnh báo mở` : 'Chưa ghi nhận sự cố'}
          </span>
        ),
        highlight: (t) => (t.activeIncidentsCount > 0 ? 'error' : null),
      },
      {
        label: 'Dự toán tự túc',
        render: (t) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
            {formatVndShort(t.estimatedBudgetVnd.min)} – {formatVndShort(t.estimatedBudgetVnd.max)} VNĐ
          </span>
        ),
      },
    ];

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderTop: '3px solid var(--color-primary)',
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMountain size={15} color="var(--color-primary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '0.02em' }}>
              So sánh chi tiết ({trails.length} cung)
            </span>
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
              color: 'var(--color-sky)',
            }}
          >
            Tháng {cmp.targetMonth} · Dữ liệu thực tế
          </span>
        </div>

        {/* Scrollable Tactical Comparison Matrix */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 4 }}>
          <table
            style={{
              width: '100%',
              minWidth: trails.length === 3 ? 460 : 340,
              borderCollapse: 'collapse',
              fontSize: '0.73rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--color-bg-main)', borderBottom: '1px solid var(--color-border-strong)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '7px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: 'var(--color-text-dim)',
                    textTransform: 'uppercase',
                    width: 112,
                  }}
                >
                  Tiêu chí
                </th>
                {trails.map((t) => (
                  <th
                    key={t.trailId}
                    style={{
                      textAlign: 'left',
                      padding: '7px 8px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      borderLeft: '1px solid var(--color-border)',
                    }}
                  >
                    <div>{t.name}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-primary)', marginTop: 1 }}>
                      {t.highlightTag}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={row.label}
                  style={{
                    borderBottom: rIdx < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: rIdx % 2 === 0 ? 'var(--color-bg-card)' : 'var(--color-bg-main)',
                  }}
                >
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-dim)', fontSize: '0.7rem' }}>
                    {row.label}
                  </td>
                  {trails.map((t) => {
                    const hl = row.highlight ? row.highlight(t) : null;
                    const cellBg =
                      hl === 'primary'
                        ? 'color-mix(in srgb, var(--color-primary) 9%, transparent)'
                        : hl === 'error'
                        ? 'color-mix(in srgb, var(--color-error) 10%, transparent)'
                        : 'transparent';
                    return (
                      <td
                        key={`${row.label}-${t.trailId}`}
                        style={{
                          padding: '6px 8px',
                          borderLeft: '1px solid var(--color-border)',
                          background: cellBg,
                          verticalAlign: 'top',
                        }}
                      >
                        {row.render(t)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Beginner vs Veteran Verdict Split */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 7 }}>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-main))',
              border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
            }}
          >
            <div style={{ fontSize: '0.67rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
              Khuyên chọn · Người mới
            </div>
            <div style={{ fontSize: '0.79rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
              {cmp.beginnerPick.name}
            </div>
            <div style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginTop: 2 }}>
              {cmp.beginnerPick.reason}
            </div>
          </div>

          <div
            style={{
              padding: '8px 10px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-earth) 9%, var(--color-bg-main))',
              border: '1px solid color-mix(in srgb, var(--color-earth) 30%, transparent)',
            }}
          >
            <div style={{ fontSize: '0.67rem', fontWeight: 800, color: 'var(--color-earth)', textTransform: 'uppercase' }}>
              Thử thách · Trekker kinh nghiệm
            </div>
            <div style={{ fontSize: '0.79rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
              {cmp.veteranPick.name}
            </div>
            <div style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginTop: 2 }}>
              {cmp.veteranPick.reason}
            </div>
          </div>
        </div>

        {/* Season Note */}
        {cmp.bestSeasonNote && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '6px 9px',
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: 'var(--color-text-main)' }}>Ghi chú mùa vụ:</strong> {cmp.bestSeasonNote}
          </div>
        )}

        {/* 1-Click Open & Go/No-Go Actions per Trail */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${trails.length}, minmax(0, 1fr))`, gap: 6 }}>
          {trails.map((t) => (
            <div key={`act-${t.trailId}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                type="button"
                onClick={() => {
                  if (onSelectTrail) {
                    onSelectTrail(t.trailId);
                    onCloseModal?.();
                  }
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontSize: '0.71rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <IconMapPin size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Mở {t.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onSendQuickPrompt(`Đánh giá Go/No-Go hôm nay cho ${t.name}`)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  color: 'var(--color-sky)',
                  border: '1px solid color-mix(in srgb, var(--color-sky) 40%, transparent)',
                  fontSize: '0.69rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <IconShieldAlert size={11} />
                <span>Go/No-Go</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 9B. Wave 12A Turnaround Time & NOAA Sunset Cutoff Pace Schedule Card (Pure SVG)
  if (action.type === 'pace_schedule_card' && action.pacePlanData) {
    const p: PacePlanResult = action.pacePlanData;
    const riskColor =
      p.pacing.afterDarkRisk === 'safe'
        ? 'var(--color-primary)'
        : p.pacing.afterDarkRisk === 'tight'
        ? 'var(--color-earth)'
        : 'var(--color-error-text, var(--color-error))';
    const riskBorderColor =
      p.pacing.afterDarkRisk === 'safe'
        ? 'var(--color-primary)'
        : p.pacing.afterDarkRisk === 'tight'
        ? 'var(--color-earth)'
        : 'var(--color-error)';
    const riskLabel =
      p.pacing.afterDarkRisk === 'safe'
        ? 'An toàn ánh sáng'
        : p.pacing.afterDarkRisk === 'tight'
        ? 'Sát giờ hoàng hôn'
        : 'Cảnh báo xuống núi trời tối';

    // Horizontal SVG Timeline scale: 04:00 (240m) -> 20:00 (1200m)
    const minWindow = 240;
    const maxWindow = 1200;
    const toX = (mins: number) => {
      const clamped = Math.max(minWindow, Math.min(maxWindow, mins));
      return 16 + ((clamped - minWindow) / (maxWindow - minWindow)) * 328;
    };
    const formatMinHHMM = (mins: number) => {
      const w = ((Math.round(mins) % 1440) + 1440) % 1440;
      return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(w % 60).padStart(2, '0')}`;
    };

    // On multi-day trips, plot coherent Summit/Turnaround Day (Day 2) solar axis so Summit NEVER plots left of Day-1 start
    const isMultiDay = p.durationDays >= 2;
    const day2StartMin = Math.max(240, Math.min(300, p.solar.sunriseMin - 90));
    const day2CampReturnCp = p.durationDays >= 3
      ? p.checkpoints.find((cp) => cp.kind === 'camp' && cp.day >= 2)
      : undefined;

    const axisStartMin = isMultiDay ? day2StartMin : p.inputs.startMinutes;
    const axisStartLabel = isMultiDay ? formatMinHHMM(day2StartMin) : p.inputs.startTime;
    const axisEndMin = day2CampReturnCp ? day2CampReturnCp.etaMinutesFromMidnight : p.pacing.finishEtaMin;
    const axisEndLabel = day2CampReturnCp ? day2CampReturnCp.etaTime : p.pacing.finishEta;

    const dawnX = toX(p.solar.civilDawnMin);
    const sunriseX = toX(p.solar.sunriseMin);
    const sunsetX = toX(p.solar.sunsetMin);
    const duskX = toX(p.solar.civilDuskMin);
    const startX = toX(axisStartMin);
    const summitX = toX(p.pacing.summitEtaMin);
    const turnaroundX = toX(p.pacing.safeTurnaroundMin);
    const finishX = toX(axisEndMin);

    const labelsCollide = Math.abs(sunsetX - startX) < 48;
    const startLabelX = Math.max(26, Math.min(334, startX));
    const sunsetLabelX = Math.max(32, Math.min(328, sunsetX));
    const turnaroundLabelX = Math.max(50, Math.min(310, turnaroundX));
    const isStartOverflowRight = axisStartMin > maxWindow;
    const isFinishOverflowRight = axisEndMin > maxWindow;

    const solarHeaderTitle =
      p.durationDays === 1
        ? `Dải Ánh Sáng NOAA (${p.solar.daylightHours}h ban ngày)`
        : p.durationDays === 2
        ? `Ánh Sáng NOAA · Ngày 2 Đỉnh & Hạ Sơn (${p.solar.daylightHours}h)`
        : `Ánh Sáng NOAA · Ngày 2 Săn Đỉnh (${p.solar.daylightHours}h)`;

    // Determine exact leg governing daylightMarginMinutes on multi-day trips
    let marginLegSubtitle = p.pacing.daylightMarginMinutes >= 0 ? 'Trước hoàng hôn' : 'Sau hoàng hôn';
    if (isMultiDay) {
      const candidateLegs: Array<{ margin: number; label: string }> = [];
      for (const cp of p.checkpoints) {
        if (cp.kind === 'camp' || cp.kind === 'finish') {
          const m = p.solar.sunsetMin - cp.etaMinutesFromMidnight;
          const legName =
            cp.kind === 'finish'
              ? `N${cp.day} về đích`
              : cp.day <= 1
              ? 'N1 tới lán'
              : `N${cp.day} về lán`;
          candidateLegs.push({ margin: m, label: legName });
        }
      }
      candidateLegs.sort((a, b) => a.margin - b.margin);
      if (candidateLegs.length > 0) {
        marginLegSubtitle = `${candidateLegs[0].label} · ${p.pacing.daylightMarginMinutes >= 0 ? 'Trước lặn' : 'Sau lặn'}`;
      }
    }

    const copyKey = `pace-${messageId}-${actionIndex}`;
    const copyText = [
      `LOST — KẾ HOẠCH TỐC ĐỘ & GIỜ QUAY ĐẦU: ${p.trailName} (${p.departureDate})`,
      `Mặt trời NOAA: Hừng đông ${p.solar.civilDawn} | Bình minh ${p.solar.sunrise} | Hoàng hôn ${p.solar.sunset} | Tắt sáng ${p.solar.civilDusk}`,
      `Giờ quay đầu an toàn (Cutoff): ${p.pacing.safeTurnaroundTime} | Xuất phát: ${p.inputs.startTime} | Lên đỉnh: ${p.pacing.summitEta} | Về đích: ${p.pacing.finishEta} (Ngày ${p.pacing.finishDay})`,
      `Thông số: ${p.distanceKm} km (+${p.elevationGainM}m), Balo ${p.inputs.packWeightKg}kg, Di chuyển ${p.pacing.totalMovingHours}h`,
      ...p.checkpoints.map((cp) => `- Ngày ${cp.day} · ${cp.etaTime} | ${cp.label} (${cp.cumulativeKm} km · ${cp.elevationM}m)`),
      `Đánh giá: ${p.pacing.riskSummary}`,
    ].join('\n');

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderLeft: `3px solid ${riskBorderColor}`,
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.78rem' }}>
              <IconClock size={14} color="var(--color-primary)" />
              <span>Kế hoạch nhịp đi &amp; giờ quay đầu (NOAA)</span>
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 3 }}>
              {p.trailName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {p.departureDate} · {p.distanceKm} km · +{p.elevationGainM.toLocaleString('vi-VN')}m · Balo {p.inputs.packWeightKg} kg
            </div>
          </div>

          <span
            style={{
              fontSize: '0.69rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 4,
              background: `color-mix(in srgb, ${riskBorderColor} 16%, var(--color-bg-main))`,
              border: `1px solid color-mix(in srgb, ${riskBorderColor} 42%, transparent)`,
              color: riskColor,
              whiteSpace: 'nowrap',
            }}
          >
            {riskLabel}
          </span>
        </div>

        {/* Pure-SVG Horizontal Daylight & Sunset Cutoff Bar */}
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '8px 8px 6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              fontSize: '0.65rem',
              color: 'var(--color-text-dim)',
              marginBottom: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{solarHeaderTitle}</span>
            <span>Bình minh {p.solar.sunrise} · Hoàng hôn {p.solar.sunset}</span>
          </div>
          <svg
            viewBox="0 0 360 72"
            width="100%"
            role="img"
            aria-label={`Biểu đồ ánh sáng ban ngày từ ${p.solar.sunrise} đến ${p.solar.sunset}, giờ quay đầu an toàn ${p.pacing.safeTurnaroundTime}`}
            style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
          >
            {/* Full night background track (04:00 - 20:00) */}
            <rect x="16" y="27" width="328" height="10" rx="3" fill="var(--color-surface-elevated)" stroke="var(--color-border)" strokeWidth="1" />
            {/* Civil twilight band (Dawn -> Dusk) */}
            <rect x={dawnX} y="27" width={Math.max(4, duskX - dawnX)} height="10" rx="2" fill="color-mix(in srgb, var(--color-sky) 28%, transparent)" />
            {/* Full daylight band (Sunrise -> Sunset) */}
            <rect x={sunriseX} y="27" width={Math.max(4, sunsetX - sunriseX)} height="10" rx="2" fill="color-mix(in srgb, var(--color-sun) 36%, transparent)" />

            {/* Start marker (Day 1 on 1-day trips; Day 2 camp start on multi-day trips) */}
            <line x1={startX} y1="21" x2={startX} y2="41" stroke="var(--color-primary)" strokeWidth="2" />
            <circle cx={startX} cy="32" r="3.5" fill="var(--color-primary)" />
            <text
              x={startLabelX}
              y={labelsCollide ? '10' : '16'}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="7.3"
              fontWeight="700"
            >
              {isStartOverflowRight ? `>20:00 (${axisStartLabel})` : isMultiDay ? `N2 ${axisStartLabel}` : axisStartLabel}
            </text>

            {/* Summit marker */}
            <circle cx={summitX} cy="32" r="3.5" fill="var(--color-sky)" />

            {/* Safe Turnaround Cutoff marker */}
            <line x1={turnaroundX} y1="19" x2={turnaroundX} y2="45" stroke="var(--color-earth)" strokeWidth="2" strokeDasharray="2.5 2" />
            <circle cx={turnaroundX} cy="32" r="4" fill="var(--color-earth)" />
            <text x={turnaroundLabelX} y="56" textAnchor="middle" fill="var(--color-earth)" fontSize="7.3" fontWeight="800">
              Quay đầu {p.pacing.safeTurnaroundTime}
            </text>

            {/* Sunset line */}
            <line x1={sunsetX} y1="22" x2={sunsetX} y2="42" stroke="var(--color-error)" strokeWidth="1.8" />
            <text
              x={sunsetLabelX}
              y={labelsCollide ? '20' : '16'}
              textAnchor="middle"
              fill="var(--color-error-text, var(--color-error))"
              fontSize="7.3"
              fontWeight="700"
            >
              Lặn {p.solar.sunset}
            </text>

            {/* Finish marker (with explicit >20:00 overflow indicator when past 20:00) */}
            <circle cx={finishX} cy="32" r="3.5" fill={riskBorderColor} stroke="var(--color-bg-card)" strokeWidth="1.2" />
            {isFinishOverflowRight && (
              <text
                x="344"
                y="47"
                textAnchor="end"
                fill="var(--color-error-text, var(--color-error))"
                fontSize="6.8"
                fontWeight="800"
              >
                &gt;20:00 ({axisEndLabel})
              </text>
            )}

            {/* Axis ticks */}
            <text x="16" y="68" textAnchor="start" fill="var(--color-text-dim)" fontSize="7">04:00</text>
            <text x="180" y="68" textAnchor="middle" fill="var(--color-text-dim)" fontSize="7">12:00</text>
            <text x="344" y="68" textAnchor="end" fill="var(--color-text-dim)" fontSize="7">20:00</text>
          </svg>
        </div>

        {/* 4 Key Cutoff Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Giờ quay đầu</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-earth)', marginTop: 1 }}>{p.pacing.safeTurnaroundTime}</div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>Mốc quay đầu an toàn</div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Đỉnh / về đích</div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
              {p.pacing.summitEta} / {p.pacing.finishEta}
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>Di chuyển {p.pacing.totalMovingHours}h</div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Dư giờ trước tối</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: riskColor, marginTop: 2 }}>
              {p.pacing.daylightMarginMinutes >= 0 ? `+${p.pacing.daylightMarginMinutes}p` : `${p.pacing.daylightMarginMinutes}p`}
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
              {marginLegSubtitle}
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Gợi ý xuất phát</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>{p.pacing.recommendedStartTime}</div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
              {p.pacing.headlampRequired ? 'Cần đèn pin' : 'Đủ ánh sáng'}
            </div>
          </div>
        </div>

        {/* Dark-Descent Warning Banner */}
        {p.pacing.afterDarkRisk !== 'safe' && (
          <div
            style={{
              padding: '7px 9px',
              borderRadius: 4,
              background: `color-mix(in srgb, ${riskBorderColor} 12%, var(--color-bg-main))`,
              border: `1px solid color-mix(in srgb, ${riskBorderColor} 40%, transparent)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
              fontSize: '0.72rem',
              color: 'var(--color-text-main)',
              lineHeight: 1.45,
            }}
          >
            <IconAlertTriangle size={14} color={riskColor} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{p.pacing.riskSummary}</span>
          </div>
        )}

        {/* Checkpoint-by-Checkpoint ETA Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.71rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-strong)', color: 'var(--color-text-dim)' }}>
                <th style={{ textAlign: 'left', padding: '4px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>ETA</th>
                <th style={{ textAlign: 'left', padding: '4px 5px', fontWeight: 700 }}>Mốc chặng</th>
                <th style={{ textAlign: 'right', padding: '4px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>Km / Cao độ</th>
              </tr>
            </thead>
            <tbody>
              {p.checkpoints.map((cp, idx) => {
                const isCutoff = cp.kind === 'turnaround';
                return (
                  <tr
                    key={`${cp.day}-${cp.etaTime}-${idx}`}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: isCutoff ? 'color-mix(in srgb, var(--color-earth) 10%, transparent)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '5px', whiteSpace: 'nowrap', fontWeight: 800, color: isCutoff ? 'var(--color-earth)' : 'var(--color-sky)' }}>
                      N{cp.day} · {cp.etaTime}
                    </td>
                    <td style={{ padding: '5px' }}>
                      <div style={{ fontWeight: isCutoff || cp.kind === 'summit' ? 800 : 700, color: 'var(--color-text-main)' }}>
                        {cp.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', lineHeight: 1.35 }}>{cp.note}</div>
                    </td>
                    <td style={{ padding: '5px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                      {cp.cumulativeKm} km · {cp.elevationM.toLocaleString('vi-VN')}m
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer 1-Click Copy Schedule */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)' }}>
            NOAA UTC+7 tại [{p.solar.summitLat}, {p.solar.summitLng}]
          </span>
          <button
            type="button"
            onClick={async () => {
              const copied = await onCopyText(copyKey, copyText);
              if (copied !== false) {
                onToast(`Đã sao chép kế hoạch tốc độ & giờ quay đầu ${p.trailName}!`);
              }
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: copiedId === copyKey ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
              background: copiedId === copyKey
                ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                : 'var(--color-bg-main)',
              color: copiedId === copyKey ? 'var(--color-primary)' : 'var(--color-text-main)',
              fontSize: '0.71rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {copiedId === copyKey ? <IconCheck size={12} color="var(--color-primary)" /> : <IconCopy size={12} />}
            <span>{copiedId === copyKey ? 'Đã sao chép lịch' : 'Sao chép kế hoạch'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 9C. Wave 14A Nutrition, Hydration & Electrolyte Planner Card (Pure SVG, Hardened Wave 15B-5)
  if (action.type === 'fuel_plan_card' && action.fuelPlanData) {
    const fp: FuelPlanResult = action.fuelPlanData;
    const barTotalW = 328;
    const rawCarbPct = Math.max(0, Math.min(100, fp.energy.carbsPct));
    const rawProteinPct = Math.max(0, Math.min(100 - rawCarbPct, fp.energy.proteinPct));
    const carbW = Math.max(0, Math.round((rawCarbPct / 100) * barTotalW));
    const proteinW = Math.max(0, Math.min(barTotalW - carbW, Math.round((rawProteinPct / 100) * barTotalW)));
    const fatW = Math.max(0, barTotalW - carbW - proteinW);
    const isGroup = fp.inputs.groupSize > 1;

    const copyKey = `fuel-${messageId}-${actionIndex}`;
    const formatVnd = (v: number) => `${v.toLocaleString('vi-VN')}đ`;
    const shoppingListText = [
      `LOST — DANH SÁCH MUA ĐỒ ĂN, NƯỚC & ĐIỆN GIẢI: ${fp.trailName} (${fp.durationDays} ngày · ${fp.inputs.dietLabel})`,
      `Thông số: ${fp.inputs.groupSize} người | ${fp.inputs.bodyWeightKg}kg + balo ${fp.inputs.packWeightKg}kg | ${fp.inputs.ambientTempC}°C, ẩm ${fp.inputs.humidityPct}%`,
      `Năng lượng (Pandolf): ${fp.energy.totalTripKcal.toLocaleString('vi-VN')} kcal (${fp.energy.dailyKcal.toLocaleString('vi-VN')} kcal/ngày; ${fp.energy.carbsGrams}g Carb · ${fp.energy.proteinGrams}g Đạm · ${fp.energy.fatGrams}g Béo)`,
      `Nước & Oresol: Tổng ${fp.hydration.waterLitersTotal}L (${fp.hydration.waterLitersPerDay}L/ngày, mang ${fp.hydration.carryWaterPerLegLiters}L/chặng) + ${fp.hydration.oresolPacketsTotal} gói Oresol WHO/người`,
      ...(fp.hydration.hydrationAlert ? [`Cảnh báo thực địa: ${fp.hydration.hydrationAlert}`] : []),
      ...(fp.hydration.waterResupplySpots.length > 0
        ? [
            `Điểm tiếp nước thực địa: ${fp.hydration.waterResupplySpots
              .map((sp) =>
                `${sp.name}${typeof sp.elevationM === 'number' && Number.isFinite(sp.elevationM) ? ` (${sp.elevationM.toLocaleString('vi-VN')}m)` : ''}`
              )
              .join(' | ')}`,
          ]
        : []),
      ...fp.rations.map(
        (r) =>
          `- [${r.mealSlot}] ${r.name}: ${r.quantityLabel} (~${r.weightGramsPerPerson}g/người${isGroup ? `, đoàn ${(r.totalGramsGroup / 1000).toFixed(2)}kg` : ''} · ${r.kcalPerPerson} kcal · ~${formatVnd(r.estimatedVndPerPerson)}/người)`
      ),
      `Tổng tải ăn + nước mang chặng: ${fp.totals.totalConsumableCarryKg} kg/người (Đồ ăn + Oresol ${fp.totals.foodWeightKgPerPerson}kg + Nước ${fp.totals.carryWaterWeightKgPerPerson}kg)`,
      `Dự toán chi phí đồ ăn + Oresol: ~${formatVnd(fp.totals.estimatedFoodCostVndPerPerson)}/người${isGroup ? ` (Đoàn ${fp.inputs.groupSize} người: ~${formatVnd(fp.totals.estimatedFoodCostVndGroup)})` : ''}`,
    ].join('\n');

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderLeft: '3px solid var(--color-sky)',
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-sky)', fontWeight: 800, fontSize: '0.78rem' }}>
              <IconDroplet size={14} color="var(--color-sky)" />
              <span>Dinh dưỡng, nước &amp; điện giải (Pandolf)</span>
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 3 }}>
              {fp.trailName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {fp.durationDays} ngày · {fp.inputs.groupSize} người · {fp.inputs.ambientTempC}°C / ẩm {fp.inputs.humidityPct}% · Balo {fp.inputs.packWeightKg}kg
            </div>
          </div>

          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-main))',
              border: '1px solid color-mix(in srgb, var(--color-primary) 38%, transparent)',
              color: 'var(--color-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {fp.inputs.dietLabel}
          </span>
        </div>

        {/* Pure-SVG Responsive Macro Energy Split Bar + Crisp HTML Legend */}
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '8px 8px 7px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              fontSize: '0.66rem',
              color: 'var(--color-text-dim)',
              marginBottom: 6,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>Cân bằng năng lượng ({fp.energy.totalTripKcal.toLocaleString('vi-VN')} kcal)</span>
            <span>
              Carb {fp.energy.carbsGrams}g · Đạm {fp.energy.proteinGrams}g · Béo {fp.energy.fatGrams}g
            </span>
          </div>
          <svg
            viewBox={`0 0 ${barTotalW} 10`}
            role="img"
            aria-label={`Tỷ lệ năng lượng ${fp.energy.carbsPct}% tinh bột, ${fp.energy.proteinPct}% đạm, ${fp.energy.fatPct}% chất béo`}
            style={{ width: '100%', height: 'auto', maxHeight: 12, display: 'block', borderRadius: 3, overflow: 'hidden' }}
          >
            {carbW > 0 && <rect x={0} y={0} width={carbW} height={10} fill="var(--color-primary)" />}
            {proteinW > 0 && <rect x={carbW} y={0} width={proteinW} height={10} fill="var(--color-sky)" />}
            {fatW > 0 && <rect x={carbW + proteinW} y={0} width={fatW} height={10} fill="var(--color-earth)" />}
          </svg>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 5,
              fontSize: '0.68rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ color: 'var(--color-primary)' }}>Tinh bột {fp.energy.carbsPct}%</span>
            <span style={{ color: 'var(--color-sky)' }}>Đạm {fp.energy.proteinPct}%</span>
            <span style={{ color: 'var(--color-earth)' }}>Chất béo {fp.energy.fatPct}%</span>
          </div>
        </div>

        {/* 4 Hydration, Electrolyte, Energy & Weight KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              {fp.hasWaterSource ? 'Nước Mang / Chặng' : 'Nước Mang / Ngày'}
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-sky)', marginTop: 1 }}>
              {fp.hydration.carryWaterPerLegLiters} L
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
              Tổng {fp.hydration.waterLitersTotal}L ({fp.hydration.waterLitersPerDay}L/n)
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Điện Giải Oresol</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-earth)', marginTop: 1 }}>
              {fp.hydration.oresolPacketsTotal} gói
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
              ~{fp.hydration.sodiumMgPerDay.toLocaleString('vi-VN')} mg Na/ngày
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Calo / Ngày</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
              {fp.energy.dailyKcal.toLocaleString('vi-VN')} kcal
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
              Vận động {fp.energy.activeKcal.toLocaleString('vi-VN')}
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Tải Ăn + Nước</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
              {fp.totals.totalConsumableCarryKg} kg
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
              Đồ ăn {fp.totals.foodWeightKgPerPerson}kg · Nước {fp.totals.carryWaterWeightKgPerPerson}kg
            </div>
          </div>
        </div>

        {/* Hydration / Dry Trail / Heat / Altitude Combined Alert */}
        {fp.hydration.hydrationAlert && (
          <div
            style={{
              padding: '7px 9px',
              borderRadius: 4,
              background: fp.hasWaterSource
                ? 'color-mix(in srgb, var(--color-earth) 12%, var(--color-bg-main))'
                : 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg-main))',
              border: fp.hasWaterSource
                ? '1px solid color-mix(in srgb, var(--color-earth) 40%, transparent)'
                : '1px solid color-mix(in srgb, var(--color-error) 42%, transparent)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
              fontSize: '0.72rem',
              color: 'var(--color-text-main)',
              lineHeight: 1.45,
            }}
          >
            <IconAlertTriangle
              size={14}
              color={fp.hasWaterSource ? 'var(--color-earth)' : 'var(--color-error-text, var(--color-error))'}
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span>{fp.hydration.hydrationAlert}</span>
          </div>
        )}

        {/* Water Resupply Spots from Real Trail Waypoints */}
        {fp.hydration.waterResupplySpots.length > 0 && (
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '7px 9px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-sky)', textTransform: 'uppercase' }}>
              Điểm tiếp nước dọc đường ({fp.hydration.waterResupplySpots.length} mốc)
            </div>
            {fp.hydration.waterResupplySpots.map((sp, idx) => (
              <div key={`${sp.name}-${idx}`} style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--color-text-main)' }}>
                  {sp.name}
                  {typeof sp.elevationM === 'number' && Number.isFinite(sp.elevationM)
                    ? ` (${sp.elevationM.toLocaleString('vi-VN')}m)`
                    : ''}
                </strong>
                {' — '}
                {sp.treatmentNote}
              </div>
            ))}
          </div>
        )}

        {/* Vietnamese Trail Rations Table (minWidth 320 for 375px readability; Table sum === Footer 1:1) */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse', fontSize: '0.71rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-strong)', color: 'var(--color-text-dim)' }}>
                <th style={{ textAlign: 'left', padding: '4px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>Bữa</th>
                <th style={{ textAlign: 'left', padding: '4px 5px', fontWeight: 700 }}>Khẩu phần thực địa</th>
                <th style={{ textAlign: 'right', padding: '4px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {isGroup ? 'KL / Giá (1 ng)' : 'Khối lượng / Giá'}
                </th>
              </tr>
            </thead>
            <tbody>
              {fp.rations.map((r, idx) => (
                <tr key={`${r.mealSlot}-${idx}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '5px', whiteSpace: 'nowrap', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {r.mealSlot}
                  </td>
                  <td style={{ padding: '5px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{r.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', lineHeight: 1.35 }}>
                      {r.quantityLabel} · {r.kcalPerPerson} kcal — {r.note}
                    </div>
                  </td>
                  <td style={{ padding: '5px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                    <div>
                      {r.weightGramsPerPerson}g{isGroup ? '/ng' : ''}
                    </div>
                    {isGroup && (
                      <div style={{ fontSize: '0.63rem', color: 'var(--color-sky)' }}>
                        Đoàn {(r.totalGramsGroup / 1000).toFixed(2)}kg
                      </div>
                    )}
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>
                      ~{formatVnd(r.estimatedVndPerPerson)}{isGroup ? '/ng' : ''}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fuel Tactical Notes */}
        {Array.isArray(fp.tacticalNotes) && fp.tacticalNotes.length > 0 && (
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '7px 9px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              Lưu ý ăn uống &amp; tiếp nước dọc đường:
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.71rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              {fp.tacticalNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Cost Summary & 1-Click Copy Shopping List */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
            Tổng đồ ăn + Oresol: <strong style={{ color: 'var(--color-text-main)' }}>~{formatVnd(fp.totals.estimatedFoodCostVndPerPerson)}/người</strong>
            {isGroup ? ` (Nhóm ${fp.inputs.groupSize}: ~${formatVnd(fp.totals.estimatedFoodCostVndGroup)})` : ''}
          </span>
          <button
            type="button"
            onClick={async () => {
              const copied = await onCopyText(copyKey, shoppingListText);
              if (copied !== false) {
                onToast(`Đã sao chép danh sách mua đồ ăn & nước ${fp.trailName}!`);
              }
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: copiedId === copyKey ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
              background: copiedId === copyKey
                ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                : 'var(--color-bg-main)',
              color: copiedId === copyKey ? 'var(--color-primary)' : 'var(--color-text-main)',
              fontSize: '0.71rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {copiedId === copyKey ? <IconCheck size={12} color="var(--color-primary)" /> : <IconCopy size={12} />}
            <span>{copiedId === copyKey ? 'Đã sao chép danh sách' : 'Sao chép danh sách mua đồ'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 9D. Wave 16A AI Expedition Readiness Audit Card (Pure-SVG Radial Gauge + 4 Pillar Bars + Pre-Flight Fixes)
  if (action.type === 'readiness_audit_card' && action.readinessAuditData) {
    const ra: ReadinessAuditResult = action.readinessAuditData;
    const verdictBorderColor =
      ra.verdict === 'READY'
        ? 'var(--color-primary)'
        : ra.verdict === 'ADJUST_BEFORE_GO'
        ? 'var(--color-earth)'
        : 'var(--color-error)';
    const verdictTextColor =
      ra.verdict === 'READY'
        ? 'var(--color-primary)'
        : ra.verdict === 'ADJUST_BEFORE_GO'
        ? 'var(--color-earth)'
        : 'var(--color-error-text, var(--color-error))';

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const clampedScore = Math.max(0, Math.min(100, ra.readinessScore));
    const dashOffset = circumference * (1 - clampedScore / 100);

    const copyKey = `readiness-${messageId}-${actionIndex}`;
    const reportText = [
      `LOST — KIỂM TRA SẴN SÀNG TRƯỚC GIỜ G: ${ra.trailName} (${ra.departureDate})`,
      `Điểm Sẵn Sàng: ${ra.readinessScore}/100 — ${ra.verdictLabel}`,
      `Thông số: Đoàn ${ra.inputs.groupSize} người | Xuất phát ${ra.inputs.startTime} | Balo ${ra.inputs.packWeightKg}kg (${ra.inputs.packRatioPercent}% / ${ra.inputs.bodyWeightKg}kg)`,
      ...ra.pillars.map((pl) => `- ${pl.label} (${pl.score}/100): ${pl.summary}`),
      'Hành động ưu tiên:',
      ...ra.topFixes.map(
        (fx, i) =>
          `${i + 1}. [${fx.priority === 'critical' ? 'KHẨN CẤP' : fx.priority === 'high' ? 'CAO' : 'LƯU Ý'}] ${fx.title}: ${fx.action}`
      ),
      `Hotline xác thực: ${ra.snapshot.emergencyPhone} | Quốc gia: 112 / 114 / 115`,
    ].join('\n');

    return (
      <div
        style={{
          marginTop: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderLeft: `3px solid ${verdictBorderColor}`,
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Top Radial Gauge + Header Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <svg
            viewBox="0 0 92 92"
            width="76"
            height="76"
            role="img"
            aria-label={`Điểm sẵn sàng ${clampedScore} trên 100: ${ra.verdictLabel}`}
            style={{ flexShrink: 0, display: 'block' }}
          >
            <circle
              cx="46"
              cy="46"
              r={radius}
              fill="var(--color-bg-main)"
              stroke="var(--color-border)"
              strokeWidth="8"
            />
            <circle
              cx="46"
              cy="46"
              r={radius}
              fill="none"
              stroke={verdictBorderColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 46 46)"
            />
            <text
              x="46"
              y="44"
              textAnchor="middle"
              dominantBaseline="central"
              fill={verdictTextColor}
              fontSize="20"
              fontWeight="900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {clampedScore}
            </text>
            <text
              x="46"
              y="62"
              textAnchor="middle"
              fill="var(--color-text-dim)"
              fontSize="9.5"
              fontWeight="700"
            >
              / 100
            </text>
          </svg>

          <div style={{ flex: 1, minWidth: 165, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Rà soát sẵn sàng trước khi đi
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: `color-mix(in srgb, ${verdictBorderColor} 8%, var(--color-bg-card))`,
                  border: `1px solid color-mix(in srgb, ${verdictBorderColor} 40%, transparent)`,
                  color: verdictTextColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {ra.verdictLabel}
              </span>
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              {ra.trailName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {ra.departureDate} · Đoàn {ra.inputs.groupSize} người · Balo {ra.inputs.packWeightKg}kg ({ra.inputs.packRatioPercent}%) · Xuất phát {ra.inputs.startTime}
            </div>
          </div>
        </div>

        {/* 4 Key Snapshot Telemetry Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Go / No-Go</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 1 }}>
              {ra.snapshot.goNoGoScore !== null ? `${ra.snapshot.goNoGoScore}/100` : 'Ngoại tuyến'}
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Quay Đầu / Lặn</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 1 }}>
              {ra.snapshot.safeTurnaroundTime} / {ra.snapshot.noaaSunset}
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Nước &amp; Oresol</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 1 }}>
              {ra.snapshot.carryWaterPerLegLiters}L · {ra.snapshot.oresolPacketsTotal} gói
            </div>
          </div>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Giấy Phép</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 1 }}>
              {ra.snapshot.isBorderPermit ? 'Biên giới' : ra.snapshot.permitRequired ? 'Cần VQG' : 'CCCD'}
            </div>
          </div>
        </div>

        {/* 4 Sub-Pillar Breakdown Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontVariantNumeric: 'tabular-nums' }}>
          {ra.pillars.map((pl) => {
            const barColor =
              pl.status === 'good'
                ? 'var(--color-primary)'
                : pl.status === 'warn'
                ? 'var(--color-earth)'
                : 'var(--color-error)';
            const labelColor =
              pl.status === 'good'
                ? 'var(--color-primary)'
                : pl.status === 'warn'
                ? 'var(--color-earth)'
                : 'var(--color-error-text, var(--color-error))';
            const pct = Math.max(0, Math.min(100, pl.score));
            return (
              <div
                key={pl.key}
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '6px 8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.73rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {pl.label} <span style={{ fontWeight: 600, color: 'var(--color-text-dim)' }}>({pl.weightPct}%)</span>
                  </span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, color: labelColor }}>
                    {pct}/100
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={pl.label}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--color-surface-elevated)',
                    overflow: 'hidden',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {pl.summary}
                </div>
              </div>
            );
          })}
        </div>

        {/* Prioritized Pre-Flight Fixes */}
        {ra.topFixes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Việc cần xử lý trước khi xuất phát ({ra.topFixes.length})
            </div>
            {ra.topFixes.map((fx, idx) => {
              const fxBorder =
                fx.priority === 'critical'
                  ? 'var(--color-error)'
                  : fx.priority === 'high'
                  ? 'var(--color-earth)'
                  : 'var(--color-primary)';
              const fxColor =
                fx.priority === 'critical'
                  ? 'var(--color-error-text, var(--color-error))'
                  : fx.priority === 'high'
                  ? 'var(--color-earth)'
                  : 'var(--color-primary)';
              const fxBadge =
                fx.priority === 'critical' ? 'Khẩn cấp' : fx.priority === 'high' ? 'Cao' : 'Lưu ý';
              return (
                <div
                  key={`${fx.pillar}-${idx}`}
                  style={{
                    padding: '6px 9px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${fxBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: fxColor,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: `color-mix(in srgb, ${fxBorder} 10%, var(--color-bg-card))`,
                      }}
                    >
                      {fxBadge}
                    </span>
                    <span style={{ fontSize: '0.73rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {fx.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.69rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    {fx.action}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Hotline & 1-Click Copy Readiness Audit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span>Hotline địa bàn:</span>
            <a
              href={`tel:${extractPrimaryDialNumber(ra.snapshot.emergencyPhone)}`}
              style={{ color: 'var(--color-primary)', fontWeight: 800, textDecoration: 'underline', fontVariantNumeric: 'tabular-nums' }}
            >
              {ra.snapshot.emergencyPhone}
            </a>
            <span>·</span>
            <a
              href="tel:112"
              style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 800, textDecoration: 'underline', fontVariantNumeric: 'tabular-nums' }}
            >
              112
            </a>
          </span>
          <button
            type="button"
            onClick={async () => {
              const copied = await onCopyText(copyKey, reportText);
              if (copied !== false) {
                onToast(`Đã sao chép báo cáo sẵn sàng ${ra.trailName} (${ra.readinessScore}/100)!`);
              }
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: copiedId === copyKey ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
              background: copiedId === copyKey
                ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                : 'var(--color-bg-main)',
              color: copiedId === copyKey ? 'var(--color-primary)' : 'var(--color-text-main)',
              fontSize: '0.71rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {copiedId === copyKey ? <IconCheck size={12} color="var(--color-primary)" /> : <IconCopy size={12} />}
            <span>{copiedId === copyKey ? 'Đã sao chép báo cáo' : 'Sao chép báo cáo'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 10. Quick Reply Suggestion Chips
  if (action.type === 'quick_reply' && Array.isArray(action.suggestions) && action.suggestions.length > 0) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {action.suggestions.map((s, sIdx) => {
          const clean = removeEmojis(s);
          return (
            <button
              key={sIdx}
              type="button"
              onClick={() => onSendQuickPrompt(clean)}
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-text-main)',
                borderRadius: 9999,
                padding: '4px 10px',
                fontSize: '0.73rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'border-color 0.16s ease, color 0.16s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                e.currentTarget.style.color = 'var(--color-text-main)';
              }}
            >
              <IconCompass size={12} color="var(--color-primary)" />
              <span>{clean}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};
