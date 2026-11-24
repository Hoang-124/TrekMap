import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  AdminCockpitSectionId,
  CockpitBeaconPoint,
  CockpitContributionPoint,
  CockpitIncidentPoint,
  CockpitInspectorSelection,
  CockpitTrailPoint,
} from './adminCockpitTypes.js';
import {
  IconAlertTriangle,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconCompass,
  IconCopy,
  IconDroplet,
  IconEdit,
  IconEye,
  IconMail,
  IconMapPin,
  IconMountain,
  IconPhone,
  IconRadio,
  IconSatellite,
  IconShieldAlert,
  IconShieldCheck,
  IconStar,
  IconTent,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
} from '../common/SvgIcons.js';

export interface AdminSpatialInspectorProps {
  selection: CockpitInspectorSelection | null;
  isStrictAdmin: boolean;
  onClose: () => void;
  onEditTrail?: (trailId: string) => void;
  onDeleteTrail?: (trailId: string, name: string) => void;
  onApproveContribution?: (id: string, name: string) => void;
  onRejectContribution?: (id: string, name: string) => void;
  onInspectContributionModal?: (id: string) => void;
  onResolveIncident?: (id: string) => void;
  onNavigateSection?: (section: AdminCockpitSectionId) => void;
}

const ExternalLinkGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CrosshairGlyph: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const BatteryGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
    <line x1="22" y1="11" x2="22" y2="13" />
  </svg>
);

const formatCoordDisplay = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
};

const formatDateVi = (value?: string): string => {
  if (!value) return 'Chưa rõ thời gian';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sanitizeTelHref = (raw: string): string => {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
};

const extractPhoneFromText = (raw?: string): string | null => {
  if (!raw) return null;
  const match = raw.match(/(?:\+84|0)[\d\s.-]{8,13}/);
  if (!match) return null;
  const digits = match[0].replace(/[^\d+]/g, '');
  return digits.length >= 9 ? digits : null;
};

const hashSeed = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
};

interface ProceduralRidgeSample {
  ratio: number;
  km: number;
  altitudeM: number;
  x: number;
  y: number;
}

interface ProceduralTopographicProfileProps {
  seedKey: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
}

const ProceduralTopographicProfile: React.FC<ProceduralTopographicProfileProps> = React.memo(
  ({ seedKey, distanceKm, elevationGainM, maxAltitudeM }) => {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const areaGradId = `inspector-elev-area-${uid}`;
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const safeMaxAlt = maxAltitudeM > 0 ? Math.round(maxAltitudeM) : 0;
    const safeGain = elevationGainM > 0 ? Math.round(elevationGainM) : 0;
    const safeDist = distanceKm > 0 ? distanceKm : 0;

    const svgWidth = 340;
    const svgHeight = 132;
    const padLeft = 10;
    const padRight = 10;
    const padTop = 24;
    const padBottom = 26;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;

    const profile = useMemo(() => {
      const seed = hashSeed(seedKey || 'lost-ridge');
      const peakRatio = 0.56 + ((seed % 17) / 100); // 0.56..0.72
      const phaseA = ((seed >> 4) % 31) * 0.21;
      const phaseB = ((seed >> 9) % 23) * 0.37;

      const peakAlt = safeMaxAlt > 0 ? safeMaxAlt : Math.max(400, safeGain + 200);
      const gainSpan = safeGain > 0 ? Math.min(safeGain, Math.max(120, peakAlt - 40)) : Math.round(peakAlt * 0.45);
      const startAlt = Math.max(0, Math.round(peakAlt - gainSpan));
      const endAlt = Math.max(0, Math.round(startAlt + gainSpan * (0.12 + ((seed >> 13) % 14) / 100)));

      const steps = 28;
      const rawAlts: number[] = [];

      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        let baseShape: number;
        if (t <= peakRatio) {
          const u = t / peakRatio;
          // Smooth S-curve ascent with deterministic alpine undulation
          const eased = u * u * (3 - 2 * u);
          const ridgeRipple =
            Math.sin(u * Math.PI * 3 + phaseA) * 0.055 * Math.sin(u * Math.PI) +
            Math.sin(u * Math.PI * 6 + phaseB) * 0.025 * Math.sin(u * Math.PI);
          baseShape = Math.min(1, Math.max(0, eased + ridgeRipple));
        } else {
          const d = (t - peakRatio) / (1 - peakRatio);
          const eased = 1 - d * d * (3 - 2 * d);
          const descentTarget = (endAlt - startAlt) / Math.max(1, peakAlt - startAlt);
          const ridgeRipple = Math.sin(d * Math.PI * 2.5 + phaseB) * 0.04 * Math.sin(d * Math.PI);
          baseShape = Math.min(1, Math.max(0, descentTarget + (1 - descentTarget) * eased + ridgeRipple));
        }
        rawAlts.push(Math.round(startAlt + (peakAlt - startAlt) * baseShape));
      }

      // Snap exact summit vertex and endpoints
      const summitIndex = Math.max(2, Math.min(steps - 2, Math.round(peakRatio * steps)));
      rawAlts[0] = startAlt;
      rawAlts[summitIndex] = peakAlt;
      rawAlts[steps] = endAlt;

      const minAlt = Math.min(...rawAlts);
      const maxAlt = Math.max(...rawAlts);
      const altRange = Math.max(50, maxAlt - minAlt);

      const samples: ProceduralRidgeSample[] = rawAlts.map((alt, idx) => {
        const ratio = idx / steps;
        const x = padLeft + ratio * plotW;
        const normY = (alt - minAlt) / altRange;
        const y = padTop + (1 - normY) * plotH;
        const km = safeDist > 0 ? Number((ratio * safeDist).toFixed(1)) : 0;
        return { ratio, km, altitudeM: alt, x, y };
      });

      const linePath = samples
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ');
      const baselineY = padTop + plotH;
      const areaPath = `${linePath} L ${(padLeft + plotW).toFixed(1)} ${baselineY.toFixed(1)} L ${padLeft.toFixed(1)} ${baselineY.toFixed(1)} Z`;

      const avgSlopePct =
        safeDist > 0 && safeGain > 0
          ? Math.min(48, Number(((safeGain / (safeDist * 1000 * peakRatio)) * 100).toFixed(1)))
          : null;

      return {
        samples,
        summit: samples[summitIndex],
        start: samples[0],
        end: samples[steps],
        linePath,
        areaPath,
        baselineY,
        avgSlopePct,
      };
    }, [seedKey, safeDist, safeGain, safeMaxAlt, plotH, plotW]);

    const activeSample = hoverIdx !== null ? profile.samples[hoverIdx] ?? null : null;

    const handlePointerMove = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
        const clamped = Math.max(padLeft, Math.min(padLeft + plotW, relX));
        const ratio = (clamped - padLeft) / plotW;
        const idx = Math.round(ratio * (profile.samples.length - 1));
        setHoverIdx(idx);
      },
      [plotW, profile.samples.length]
    );

    const handlePointerLeave = useCallback(() => {
      setHoverIdx(null);
    }, []);

    return (
      <div className="admin-elev-chart">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: '0.67rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--color-text-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <IconMountain size={12} color="var(--color-primary)" />
            Mặt cắt địa hình
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: activeSample ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {activeSample
              ? `${safeDist > 0 ? `${activeSample.km} km · ` : ''}${activeSample.altitudeM.toLocaleString('vi-VN')} m`
              : profile.avgSlopePct !== null
                ? `Độ dốc TB ~${profile.avgSlopePct}%`
                : 'Mô phỏng địa hình'}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label={`Biểu đồ mặt cắt cao độ đỉnh ${profile.summit.altitudeM} mét`}
          onMouseMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal topographic elevation grid hairlines */}
          {[0, 0.5, 1].map((frac) => {
            const y = padTop + frac * plotH;
            return (
              <line
                key={frac}
                x1={padLeft}
                y1={y}
                x2={padLeft + plotW}
                y2={y}
                stroke="var(--color-border-strong)"
                strokeWidth="0.75"
                strokeDasharray={frac === 1 ? undefined : '2.5 3.5'}
                opacity={frac === 1 ? 0.9 : 0.45}
              />
            );
          })}

          {/* Subtle vertical summit guide */}
          <line
            x1={profile.summit.x}
            y1={profile.summit.y}
            x2={profile.summit.x}
            y2={profile.baselineY}
            stroke="var(--color-primary)"
            strokeWidth="0.85"
            strokeDasharray="2 3"
            opacity="0.45"
          />

          {/* Shaded topographic elevation area */}
          <path d={profile.areaPath} fill={`url(#${areaGradId})`} />

          {/* Crisp ridge contour polyline */}
          <path
            d={profile.linePath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Start & End elevation anchor dots */}
          <circle
            cx={profile.start.x}
            cy={profile.start.y}
            r="2.6"
            fill="var(--color-bg-card)"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
          />
          <circle
            cx={profile.end.x}
            cy={profile.end.y}
            r="2.6"
            fill="var(--color-bg-card)"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
          />

          {/* Summit peak reticle marker */}
          <g transform={`translate(${profile.summit.x.toFixed(1)}, ${profile.summit.y.toFixed(1)})`}>
            <circle r="7" fill="none" stroke="var(--color-primary)" strokeWidth="1" opacity="0.45" />
            <line x1="-10" y1="0" x2="-4.5" y2="0" stroke="var(--color-primary)" strokeWidth="1" opacity="0.75" />
            <line x1="4.5" y1="0" x2="10" y2="0" stroke="var(--color-primary)" strokeWidth="1" opacity="0.75" />
            <line x1="0" y1="-10" x2="0" y2="-4.5" stroke="var(--color-primary)" strokeWidth="1" opacity="0.75" />
            <polygon
              points="0,-3.8 3.8,0 0,3.8 -3.8,0"
              fill="var(--color-primary)"
              stroke="var(--color-bg-card)"
              strokeWidth="1"
            />
          </g>

          {/* Summit altitude label */}
          <text
            x={Math.min(svgWidth - 42, Math.max(44, profile.summit.x))}
            y={Math.max(11, profile.summit.y - 11)}
            textAnchor="middle"
            fill="var(--color-text-main)"
            fontSize="10"
            fontWeight="700"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {`${profile.summit.altitudeM.toLocaleString('vi-VN')}m`}
          </text>

          {/* Interactive scrub cursor */}
          {activeSample && (
            <g>
              <line
                x1={activeSample.x}
                y1={padTop}
                x2={activeSample.x}
                y2={profile.baselineY}
                stroke="var(--color-text-muted)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              <circle
                cx={activeSample.x}
                cy={activeSample.y}
                r="4"
                fill="var(--color-bg-card)"
                stroke="var(--color-primary)"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Baseline elevation ticks: Start / Summit / End */}
          <text
            x={padLeft}
            y={svgHeight - 6}
            textAnchor="start"
            fill="var(--color-text-dim)"
            fontSize="9.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {`0 km · ${profile.start.altitudeM.toLocaleString('vi-VN')}m`}
          </text>
          <text
            x={profile.summit.x}
            y={svgHeight - 6}
            textAnchor="middle"
            fill="var(--color-primary)"
            fontSize="9.5"
            fontWeight="600"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {safeDist > 0 ? `Đỉnh ${profile.summit.km} km` : 'Đỉnh'}
          </text>
          <text
            x={padLeft + plotW}
            y={svgHeight - 6}
            textAnchor="end"
            fill="var(--color-text-dim)"
            fontSize="9.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {safeDist > 0
              ? `${safeDist} km · ${profile.end.altitudeM.toLocaleString('vi-VN')}m`
              : `${profile.end.altitudeM.toLocaleString('vi-VN')}m`}
          </text>
        </svg>
      </div>
    );
  }
);

ProceduralTopographicProfile.displayName = 'ProceduralTopographicProfile';

interface CoverStripProps {
  coverImage?: string;
  title: string;
  region?: string;
  maxAltitudeM?: number;
  badgeText?: string;
  badgeTone?: 'ok' | 'warn' | 'danger' | 'info';
}

const CoverMediaStrip: React.FC<CoverStripProps> = React.memo(
  ({ coverImage, title, region, maxAltitudeM, badgeText, badgeTone }) => {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showImage = Boolean(coverImage) && failedUrl !== coverImage;

    const handleImgError = useCallback(() => {
      if (coverImage) setFailedUrl(coverImage);
    }, [coverImage]);

    return (
      <div
        style={{
          position: 'relative',
          height: 142,
          borderRadius: 5,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-elevated))',
          flexShrink: 0,
        }}
      >
        {showImage && coverImage ? (
          <img
            src={coverImage}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={handleImgError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <svg
            viewBox="0 0 360 142"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            style={{ display: 'block' }}
          >
            <path
              d="M0 112 Q 70 86 140 98 T 280 76 T 360 92 L360 142 L0 142 Z"
              fill="var(--color-primary)"
              opacity="0.14"
            />
            <path
              d="M0 94 Q 88 52 174 72 T 360 54"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.2"
              opacity="0.35"
            />
            <path
              d="M0 72 Q 112 34 210 56 T 360 36"
              fill="none"
              stroke="var(--color-sky)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.35"
            />
            <g transform="translate(180, 62)" opacity="0.55">
              <path
                d="M-18 14 L-4 -10 L6 4 L12 -4 L22 14 Z"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        )}

        {/* Top-left region + badge overlay */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {region ? (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 4,
                fontSize: '0.67rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                background: 'var(--overlay-bg)',
                color: 'var(--color-on-media)',
              }}
            >
              {region}
            </span>
          ) : (
            <span />
          )}

          {badgeText && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 4,
                fontSize: '0.67rem',
                fontWeight: 700,
                background:
                  badgeTone === 'danger'
                    ? 'var(--color-error)'
                    : badgeTone === 'ok'
                      ? 'var(--color-primary)'
                      : 'var(--overlay-bg)',
                color:
                  badgeTone === 'danger'
                    ? 'var(--color-on-danger)'
                    : badgeTone === 'ok'
                      ? 'var(--color-on-primary)'
                      : 'var(--color-on-media)',
              }}
            >
              {badgeText}
            </span>
          )}
        </div>

        {/* Bottom-right altitude pill */}
        {typeof maxAltitudeM === 'number' && maxAltitudeM > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              padding: '3px 8px',
              borderRadius: 4,
              background: 'var(--overlay-bg)',
              color: 'var(--color-on-media)',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <IconMountain size={12} color="var(--color-on-media)" />
            {`${Math.round(maxAltitudeM).toLocaleString('vi-VN')} m`}
          </div>
        )}
      </div>
    );
  }
);

CoverMediaStrip.displayName = 'CoverMediaStrip';

interface CapabilityBadgeProps {
  label: string;
  active: boolean;
  tone?: 'ok' | 'warn' | 'info';
  icon: React.ReactNode;
}

const CapabilityBadge: React.FC<CapabilityBadgeProps> = ({ label, active, tone = 'ok', icon }) => {
  const toneClass = active
    ? tone === 'warn'
      ? 'admin-tag admin-tag--warn'
      : tone === 'info'
        ? 'admin-tag admin-tag--info'
        : 'admin-tag admin-tag--ok'
    : 'admin-tag';

  return (
    <span
      className={toneClass}
      style={{
        padding: '4px 8px',
        opacity: active ? 1 : 0.56,
        fontWeight: active ? 600 : 500,
      }}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};

const getSeverityMeta = (severity: string): { label: string; tagClass: string; dotClass: string } => {
  const norm = (severity || '').toLowerCase();
  if (norm === 'critical' || norm === 'nghiêm trọng' || norm === 'high' || norm === 'cao') {
    return {
      label: norm === 'critical' || norm === 'nghiêm trọng' ? 'Nghiêm trọng' : 'Mức độ cao',
      tagClass: 'admin-tag admin-tag--danger',
      dotClass: 'admin-dot admin-dot--danger',
    };
  }
  if (norm === 'medium' || norm === 'moderate' || norm === 'trung bình') {
    return {
      label: 'Trung bình',
      tagClass: 'admin-tag admin-tag--warn',
      dotClass: 'admin-dot admin-dot--warn',
    };
  }
  return {
    label: severity || 'Thấp',
    tagClass: 'admin-tag admin-tag--info',
    dotClass: 'admin-dot admin-dot--info',
  };
};

const getContributionStatusMeta = (status: string): { label: string; tone: 'ok' | 'warn' | 'danger' | 'info' } => {
  const norm = (status || '').toLowerCase();
  if (norm === 'approved') return { label: 'Đã phê duyệt', tone: 'ok' };
  if (norm === 'rejected') return { label: 'Đã từ chối', tone: 'danger' };
  return { label: 'Chờ kiểm duyệt', tone: 'warn' };
};

const getReputationTier = (score: number): { label: string; nextCap: number; percent: number } => {
  if (score >= 1500) {
    return { label: 'Thủ lĩnh thực địa', nextCap: 2500, percent: Math.min(100, Math.round((score / 2500) * 100)) };
  }
  if (score >= 600) {
    return { label: 'Chuyên gia địa hình', nextCap: 1500, percent: Math.min(100, Math.round((score / 1500) * 100)) };
  }
  if (score >= 200) {
    return { label: 'Người dẫn đường', nextCap: 600, percent: Math.min(100, Math.round((score / 600) * 100)) };
  }
  return { label: 'Tân binh thực địa', nextCap: 200, percent: Math.min(100, Math.max(4, Math.round((score / 200) * 100))) };
};

const extractSelectionHeader = (
  selection: CockpitInspectorSelection
): {
  typeLabel: string;
  typeTagClass: string;
  title: string;
  subtitle: string;
  coords: { lat: number; lng: number } | null;
} => {
  switch (selection.kind) {
    case 'trail': {
      const t: CockpitTrailPoint = selection.data;
      const hasCoords = Number.isFinite(t.startLat) && Number.isFinite(t.startLng) && (t.startLat !== 0 || t.startLng !== 0);
      return {
        typeLabel: 'TUYẾN THỰC ĐỊA',
        typeTagClass: 'admin-tag admin-tag--ok',
        title: t.name,
        subtitle: [t.district, t.province, t.region].filter(Boolean).join(' · '),
        coords: hasCoords ? { lat: t.startLat, lng: t.startLng } : null,
      };
    }
    case 'contribution': {
      const c: CockpitContributionPoint = selection.data;
      const hasCoords =
        typeof c.startLat === 'number' &&
        typeof c.startLng === 'number' &&
        Number.isFinite(c.startLat) &&
        Number.isFinite(c.startLng) &&
        (c.startLat !== 0 || c.startLng !== 0);
      return {
        typeLabel: 'HỒ SƠ ĐÓNG GÓP',
        typeTagClass: 'admin-tag admin-tag--warn',
        title: c.name,
        subtitle: [c.district, c.province, c.region].filter(Boolean).join(' · ') || 'Hồ sơ tuyến mới',
        coords: hasCoords && c.startLat !== undefined && c.startLng !== undefined ? { lat: c.startLat, lng: c.startLng } : null,
      };
    }
    case 'incident': {
      const inc: CockpitIncidentPoint = selection.data;
      const hasCoords =
        typeof inc.lat === 'number' &&
        typeof inc.lng === 'number' &&
        Number.isFinite(inc.lat) &&
        Number.isFinite(inc.lng) &&
        (inc.lat !== 0 || inc.lng !== 0);
      return {
        typeLabel: 'SỰ CỐ',
        typeTagClass: inc.resolved ? 'admin-tag admin-tag--ok' : 'admin-tag admin-tag--danger',
        title: inc.trailName,
        subtitle: [inc.type, inc.locationNote].filter(Boolean).join(' · ') || 'Cảnh báo an toàn thực địa',
        coords: hasCoords && inc.lat !== undefined && inc.lng !== undefined ? { lat: inc.lat, lng: inc.lng } : null,
      };
    }
    case 'beacon': {
      const b: CockpitBeaconPoint = selection.data;
      const hasCoords =
        typeof b.lat === 'number' &&
        typeof b.lng === 'number' &&
        Number.isFinite(b.lat) &&
        Number.isFinite(b.lng) &&
        (b.lat !== 0 || b.lng !== 0);
      return {
        typeLabel: 'LIVE BEACON',
        typeTagClass:
          b.status === 'sos'
            ? 'admin-tag admin-tag--danger'
            : b.status === 'active'
              ? 'admin-tag admin-tag--ok'
              : 'admin-tag',
        title: b.displayName,
        subtitle: b.trailName || 'Đèn hiệu định vị trực tiếp',
        coords: hasCoords && b.lat !== undefined && b.lng !== undefined ? { lat: b.lat, lng: b.lng } : null,
      };
    }
    case 'user': {
      const u = selection.data;
      return {
        typeLabel: 'THÀNH VIÊN',
        typeTagClass: u.isBanned ? 'admin-tag admin-tag--danger' : 'admin-tag admin-tag--info',
        title: u.fullName,
        subtitle: u.email,
        coords: null,
      };
    }
  }
};

export const AdminSpatialInspector: React.FC<AdminSpatialInspectorProps> = React.memo(
  ({
    selection,
    isStrictAdmin,
    onClose,
    onEditTrail,
    onDeleteTrail,
    onApproveContribution,
    onRejectContribution,
    onInspectContributionModal,
    onResolveIncident,
    onNavigateSection,
  }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const copyTimerRef = useRef<number | null>(null);
    const [avatarBrokenUrl, setAvatarBrokenUrl] = useState<string | null>(null);

    useEffect(() => {
      return () => {
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current);
        }
      };
    }, []);

    const header = useMemo(() => (selection ? extractSelectionHeader(selection) : null), [selection]);

    const coordKey = header?.coords
      ? `${header.coords.lat.toFixed(6)}, ${header.coords.lng.toFixed(6)}`
      : null;

    const handleCopyCoords = useCallback(() => {
      if (!coordKey) return;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(coordKey).catch(() => {
          // Ignore clipboard denial on restricted origins
        });
      }
      setCopiedKey(coordKey);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedKey(null);
        copyTimerRef.current = null;
      }, 1800);
    }, [coordKey]);

    if (!selection || !header) {
      return null;
    }

    const isCopied = coordKey !== null && copiedKey === coordKey;

    const renderBody = (): React.ReactNode => {
      if (selection.kind === 'trail') {
        const t = selection.data;
        const difficultyLabel =
          typeof t.difficultyLevel === 'number' && t.difficultyLevel > 0
            ? `Độ khó ${t.difficultyLevel}/5`
            : undefined;

        return (
          <>
            <CoverMediaStrip
              coverImage={t.coverImage}
              title={t.name}
              region={t.region}
              maxAltitudeM={t.maxAltitudeM}
              badgeText={difficultyLabel}
              badgeTone={t.difficultyLevel && t.difficultyLevel >= 4 ? 'danger' : 'info'}
            />

            <ProceduralTopographicProfile
              seedKey={`trail-${t.id}-${t.name}`}
              distanceKm={t.distanceKm}
              elevationGainM={t.elevationGainM}
              maxAltitudeM={t.maxAltitudeM}
            />

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Cự ly tuyến</span>
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`${t.distanceKm} km`}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Tổng độ cao</span>
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`+${Math.round(t.elevationGainM).toLocaleString('vi-VN')} m`}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Đỉnh cao nhất</span>
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`${Math.round(t.maxAltitudeM).toLocaleString('vi-VN')} m`}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">
                  {typeof t.rating === 'number' && t.rating > 0 ? 'Đánh giá / Thời lượng' : 'Thời lượng'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {typeof t.rating === 'number' && t.rating > 0 ? (
                    <strong
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <IconStar size={13} color="var(--color-sun)" fill="var(--color-sun)" />
                      {t.rating.toFixed(1)}
                      <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-dim)' }}>
                        {`(${t.reviewCount ?? 0})`}
                      </span>
                    </strong>
                  ) : null}
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {t.durationHoursNote || 'Chưa cập nhật'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Hạ tầng &amp; điều kiện thực địa
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <CapabilityBadge
                  label={t.permitRequired ? 'Cần giấy phép kiểm lâm' : 'Không yêu cầu giấy phép'}
                  active={Boolean(t.permitRequired)}
                  tone="warn"
                  icon={<IconShieldAlert size={12} />}
                />
                <CapabilityBadge
                  label="Bãi cắm trại"
                  active={Boolean(t.hasCampsite)}
                  tone="ok"
                  icon={<IconTent size={12} />}
                />
                <CapabilityBadge
                  label="Nguồn nước"
                  active={Boolean(t.hasWaterSource)}
                  tone="info"
                  icon={<IconDroplet size={12} />}
                />
                <CapabilityBadge
                  label="Gia đình"
                  active={Boolean(t.kidFriendly)}
                  tone="ok"
                  icon={<IconUsers size={12} />}
                />
              </div>
            </div>

            {t.permitRequired && t.permitInfo && (
              <div className="admin-note-box admin-note-box--warn">
                <strong style={{ display: 'block', marginBottom: 3 }}>Lưu ý thủ tục kiểm lâm</strong>
                <span>{t.permitInfo}</span>
              </div>
            )}
          </>
        );
      }

      if (selection.kind === 'contribution') {
        const c = selection.data;
        const statusMeta = getContributionStatusMeta(c.status);
        const dist = c.distanceKm ?? 0;
        const gain = c.elevationGainM ?? 0;
        const peak = c.maxAltitudeM ?? 0;

        return (
          <>
            <CoverMediaStrip
              coverImage={c.coverImage}
              title={c.name}
              region={c.region}
              maxAltitudeM={peak > 0 ? peak : undefined}
              badgeText={statusMeta.label}
              badgeTone={statusMeta.tone}
            />

            {(peak > 0 || gain > 0 || dist > 0) && (
              <ProceduralTopographicProfile
                seedKey={`contrib-${c.id}-${c.name}`}
                distanceKm={dist}
                elevationGainM={gain}
                maxAltitudeM={peak}
              />
            )}

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Cự ly đề xuất</span>
                <strong
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dist > 0 ? `${dist} km` : 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Tổng độ cao</span>
                <strong
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {gain > 0 ? `+${Math.round(gain).toLocaleString('vi-VN')} m` : 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Đỉnh cao nhất</span>
                <strong
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {peak > 0 ? `${Math.round(peak).toLocaleString('vi-VN')} m` : 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Thời lượng</span>
                <strong style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  {c.durationHoursNote || 'Chưa khai báo'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Điều kiện khai báo
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <CapabilityBadge
                  label="Giấy phép kiểm lâm"
                  active={Boolean(c.permitRequired)}
                  tone="warn"
                  icon={<IconShieldAlert size={12} />}
                />
                <CapabilityBadge
                  label="Bãi cắm trại"
                  active={Boolean(c.hasCampsite)}
                  tone="ok"
                  icon={<IconTent size={12} />}
                />
                <CapabilityBadge
                  label="Nguồn nước"
                  active={Boolean(c.hasWaterSource)}
                  tone="info"
                  icon={<IconDroplet size={12} />}
                />
              </div>
            </div>

            <div className="admin-note-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <strong style={{ color: 'var(--color-text-main)', fontSize: '0.78rem' }}>
                  {c.authorName || 'Thành viên đóng góp'}
                </strong>
                <span className={`admin-tag admin-tag--${statusMeta.tone}`}>{statusMeta.label}</span>
              </div>
              {c.authorEmail && (
                <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>{c.authorEmail}</div>
              )}
              <div style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
                {`Gửi hồ sơ: ${formatDateVi(c.createdAt)}`}
              </div>
            </div>
          </>
        );
      }

      if (selection.kind === 'incident') {
        const inc = selection.data;
        const sev = getSeverityMeta(inc.severity);

        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className={sev.tagClass}>
                <span className={sev.dotClass} />
                {`Mức độ: ${sev.label}`}
              </span>
              <span className={inc.isSynthetic ? 'admin-tag admin-tag--info' : 'admin-tag'}>
                {inc.isSynthetic ? <IconSatellite size={12} /> : <IconUsers size={12} />}
                {inc.isSynthetic ? 'Nguồn vệ tinh / Tự động' : 'Báo cáo cộng đồng'}
              </span>
              <span className={inc.resolved ? 'admin-tag admin-tag--ok' : 'admin-tag admin-tag--danger'}>
                {inc.resolved ? 'Đã xử lý' : 'Đang hiệu lực'}
              </span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Mô tả diễn biến thực địa
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  lineHeight: 1.55,
                  color: 'var(--color-text-main)',
                }}
              >
                {inc.description || 'Chưa có mô tả chi tiết cho cảnh báo này.'}
              </p>
            </div>

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Tuyến ảnh hưởng</span>
                <strong style={{ fontSize: '0.84rem', color: 'var(--color-text-main)' }}>{inc.trailName}</strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Vị trí ghi nhận</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {inc.locationNote || 'Theo tọa độ tuyến'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Người báo cáo</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 600 }}>
                  {inc.reporterName || (inc.isSynthetic ? 'Hệ thống vệ tinh' : 'Thành viên cộng đồng')}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Thời điểm ghi nhận</span>
                <strong
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDateVi(inc.reportedAt)}
                </strong>
              </div>
            </div>

            {inc.disputesCount > 0 && (
              <div
                className={
                  inc.disputesCount >= 3
                    ? 'admin-note-box admin-note-box--danger'
                    : 'admin-note-box admin-note-box--warn'
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 3 }}>
                  <IconAlertTriangle size={14} />
                  <span>{`${inc.disputesCount} phản bác từ cộng đồng`}</span>
                </div>
                <span>
                  Cảnh báo này đang có ý kiến trái chiều từ trekker tại thực địa. Hãy rà soát và gỡ bỏ nếu tuyến đã an toàn trở lại.
                </span>
              </div>
            )}
          </>
        );
      }

      if (selection.kind === 'beacon') {
        const b = selection.data;
        const isSos = b.status === 'sos';
        const isActive = b.status === 'active';
        const battery = typeof b.batteryPercent === 'number' ? Math.max(0, Math.min(100, Math.round(b.batteryPercent))) : null;
        const isBatteryCritical = battery !== null && battery <= 20;
        const isBatteryWarn = battery !== null && battery > 20 && battery <= 40;
        const batteryColor = isBatteryCritical
          ? 'var(--color-error)'
          : isBatteryWarn
            ? 'var(--color-sun)'
            : 'var(--color-primary)';

        const pingText =
          typeof b.minutesSinceLastPing === 'number'
            ? b.minutesSinceLastPing <= 1
              ? 'Vừa cập nhật (<1 phút)'
              : `${b.minutesSinceLastPing} phút trước`
            : formatDateVi(b.lastPingAt);

        const telHref = b.phone ? sanitizeTelHref(b.phone) : '';
        const emergencyPhone = extractPhoneFromText(b.emergencyContact);

        return (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 5,
                border: `1px solid ${
                  isSos
                    ? 'color-mix(in srgb, var(--color-error) 35%, transparent)'
                    : 'var(--color-border)'
                }`,
                background: isSos
                  ? 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-main))'
                  : 'var(--color-bg-main)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={
                    isSos
                      ? 'admin-readiness-lamp admin-readiness-lamp--danger'
                      : isActive
                        ? 'admin-readiness-lamp admin-readiness-lamp--ok'
                        : 'admin-readiness-lamp'
                  }
                />
                <strong
                  style={{
                    fontSize: '0.78rem',
                    letterSpacing: '0.03em',
                    color: isSos
                      ? 'var(--color-error-text, var(--color-error))'
                      : isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {isSos ? 'TÍN HIỆU KHẨN CẤP SOS' : isActive ? 'ĐÈN HIỆU ĐANG HOẠT ĐỘNG' : 'PHIÊN ĐÃ KẾT THÚC'}
                </strong>
              </div>
              {b.isSignalStale && <span className="admin-tag admin-tag--warn">Mất ping</span>}
            </div>

            {/* Battery precision gauge */}
            <div
              style={{
                padding: '11px 12px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--color-text-dim)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <BatteryGlyph size={13} />
                  Dung lượng pin thiết bị
                </span>
                <strong
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: battery === null ? 'var(--color-text-dim)' : batteryColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {battery !== null ? `${battery}%` : 'Chưa rõ'}
                </strong>
              </div>
              <div
                role="progressbar"
                aria-valuenow={battery ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Mức pin đèn hiệu"
                style={{
                  height: 7,
                  borderRadius: 3,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${battery ?? 0}%`,
                    height: '100%',
                    background: batteryColor,
                    transition: 'width var(--dur-base) var(--ease-out-expo)',
                  }}
                />
              </div>
              {isBatteryCritical && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-error-text, var(--color-error))' }}>
                  Cảnh báo pin dưới 20% — nguy cơ gián đoạn tín hiệu định vị.
                </span>
              )}
            </div>

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Cao độ GPS</span>
                <strong
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {typeof b.altitudeM === 'number' ? `${Math.round(b.altitudeM).toLocaleString('vi-VN')} m` : '—'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Quãng đường</span>
                <strong
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {typeof b.distanceKm === 'number' ? `${b.distanceKm.toFixed(1)} km` : '—'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Độ tươi tín hiệu</span>
                <strong
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: b.isSignalStale ? 'var(--color-sun)' : 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pingText}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Mã đèn hiệu</span>
                <span className="admin-code">{b.token.slice(0, 12)}</span>
              </div>
            </div>

            {b.emergencyNote && (
              <div className={isSos ? 'admin-note-box admin-note-box--danger' : 'admin-note-box admin-note-box--warn'}>
                <strong style={{ display: 'block', marginBottom: 3 }}>Ghi chú khẩn cấp từ trekker</strong>
                <span>{b.emergencyNote}</span>
              </div>
            )}

            {/* Direct contact controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Kênh liên lạc trực tiếp
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {telHref && b.phone && (
                  <a href={telHref} className="admin-btn admin-btn--sm">
                    <IconPhone size={13} />
                    <span>{b.phone}</span>
                  </a>
                )}
                {b.email && (
                  <a href={`mailto:${b.email}`} className="admin-btn admin-btn--sm">
                    <IconMail size={13} />
                    <span>{b.email}</span>
                  </a>
                )}
                {!telHref && !b.email && (
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)' }}>
                    Chưa có số điện thoại hoặc email trực tiếp.
                  </span>
                )}
              </div>
              {b.emergencyContact && (
                <div className="admin-note-box" style={{ marginTop: 2 }}>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>
                    Liên hệ người thân / Cứu hộ
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--color-text-main)', fontSize: '0.79rem' }}>
                      {b.emergencyContact}
                    </strong>
                    {emergencyPhone && (
                      <a href={`tel:${emergencyPhone}`} className="admin-btn admin-btn--sm admin-btn--danger-ghost">
                        <IconPhone size={12} />
                        <span>Gọi ngay</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      }

      // User selection
      const u = selection.data;
      const tier = getReputationTier(u.reputationScore);
      const roleUpper = (u.role || 'user').toUpperCase();
      const roleTagClass =
        roleUpper === 'ADMIN'
          ? 'admin-tag admin-tag--ok'
          : roleUpper === 'MODERATOR'
            ? 'admin-tag admin-tag--info'
            : 'admin-tag';
      const showAvatar = Boolean(u.avatarUrl) && avatarBrokenUrl !== u.avatarUrl;
      const initials = (u.fullName || 'U')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

      return (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px',
              borderRadius: 5,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
            }}
          >
            {showAvatar && u.avatarUrl ? (
              <img
                src={u.avatarUrl}
                alt={u.fullName}
                loading="lazy"
                decoding="async"
                onError={() => setAvatarBrokenUrl(u.avatarUrl ?? null)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--color-border-strong)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  border: '1px solid var(--color-border-strong)',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials || <IconUser size={18} />}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className={roleTagClass}>{roleUpper}</span>
                {u.isBanned ? (
                  <span className="admin-tag admin-tag--danger">Đang khóa</span>
                ) : (
                  <span className="admin-tag admin-tag--ok">Hoạt động</span>
                )}
              </div>
              <span
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--color-text-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {`ID: ${u.id}`}
              </span>
            </div>
          </div>

          {u.isBanned && (
            <div className="admin-note-box admin-note-box--danger">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 3 }}>
                <IconShieldAlert size={14} />
                <span>Tài khoản đang bị đình chỉ</span>
              </div>
              <span>{u.banReason || 'Vi phạm quy chuẩn an toàn cộng đồng LOST.'}</span>
            </div>
          )}

          {/* Reputation bar */}
          <div
            style={{
              padding: '12px',
              borderRadius: 5,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                {`Điểm uy tín · ${tier.label}`}
              </span>
              <strong
                style={{
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {u.reputationScore.toLocaleString('vi-VN')}
              </strong>
            </div>
            <div
              role="progressbar"
              aria-valuenow={tier.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Tiến trình uy tín thành viên"
              style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--color-surface-elevated)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${tier.percent}%`,
                  height: '100%',
                  background: 'var(--color-primary)',
                  transition: 'width var(--dur-base) var(--ease-out-expo)',
                }}
              />
            </div>
            <span style={{ fontSize: '0.69rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {`Mốc tiếp theo: ${tier.nextCap.toLocaleString('vi-VN')} điểm`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-text-dim)',
              }}
            >
              {`Huy hiệu đã đạt (${u.badges.length})`}
            </span>
            {u.badges.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {u.badges.map((badge) => (
                  <span key={badge} className="admin-tag admin-tag--ok">
                    <IconShieldCheck size={11} />
                    <span>{badge}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)' }}>
                Thành viên chưa mở khóa huy hiệu thực địa.
              </span>
            )}
          </div>
        </>
      );
    };

    const renderFooter = (): React.ReactNode => {
      switch (selection.kind) {
        case 'trail': {
          const t = selection.data;
          return (
            <>
              {isStrictAdmin && onEditTrail && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onEditTrail(t.id)}
                >
                  <IconEdit size={13} />
                  <span>Chỉnh sửa đầy đủ</span>
                </button>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('trails')}
                >
                  <IconCompass size={13} />
                  <span>Mở kho cung đường</span>
                </button>
              )}
              {isStrictAdmin && onDeleteTrail && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                  onClick={() => onDeleteTrail(t.id, t.name)}
                  aria-label={`Xóa cung đường ${t.name}`}
                  style={{ marginLeft: 'auto' }}
                >
                  <IconTrash size={13} />
                  <span>Xóa</span>
                </button>
              )}
            </>
          );
        }

        case 'contribution': {
          const c = selection.data;
          const normStatus = (c.status || '').toLowerCase();
          return (
            <>
              {onInspectContributionModal && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onInspectContributionModal(c.id)}
                >
                  <IconEye size={13} />
                  <span>Hồ sơ chi tiết</span>
                </button>
              )}
              {normStatus !== 'approved' && onApproveContribution && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onApproveContribution(c.id, c.name)}
                >
                  <IconCheckCircle size={13} />
                  <span>Phê duyệt</span>
                </button>
              )}
              {normStatus !== 'rejected' && onRejectContribution && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                  onClick={() => onRejectContribution(c.id, c.name)}
                >
                  <IconX size={13} />
                  <span>Từ chối</span>
                </button>
              )}
            </>
          );
        }

        case 'incident': {
          const inc = selection.data;
          return (
            <>
              {!inc.isSynthetic && !inc.resolved && onResolveIncident && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onResolveIncident(inc.id)}
                >
                  <IconCheckCircle size={13} />
                  <span>Gỡ cảnh báo</span>
                </button>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('incidents')}
                >
                  <IconAlertTriangle size={13} />
                  <span>Mở mục sự cố</span>
                </button>
              )}
            </>
          );
        }

        case 'beacon': {
          const b = selection.data;
          return (
            <>
              <a
                href={b.sharePath}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn--sm admin-btn--primary"
              >
                <IconRadio size={13} />
                <span>Mở bản đồ Live Beacon</span>
                <ExternalLinkGlyph size={12} />
              </a>
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('safety')}
                >
                  <IconClock size={13} />
                  <span>Giám sát an toàn</span>
                </button>
              )}
            </>
          );
        }

        case 'user':
          return onNavigateSection ? (
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--primary"
              onClick={() => onNavigateSection('users')}
            >
              <IconUsers size={13} />
              <span>Mở quản lý thành viên</span>
            </button>
          ) : null;
      }
    };

    const footerContent = renderFooter();

    return (
      <>
        <div className="admin-inspector-backdrop" onClick={onClose} aria-hidden="true" />
        <aside className="admin-inspector-pane" aria-label="Bảng thanh tra tọa độ thực địa">
          <div className="admin-inspector-head">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span className={header.typeTagClass} style={{ letterSpacing: '0.06em' }}>
                {header.typeLabel}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--ghost"
                onClick={onClose}
                aria-label="Đóng bảng thanh tra"
                title="Đóng bảng thanh tra (Esc)"
                style={{ padding: '0 7px', gap: 5 }}
              >
                <span className="admin-kbd-chip">Esc</span>
                <IconX size={14} />
              </button>
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text-main)',
                }}
              >
                {header.title}
              </h3>

              {header.subtitle && (
                <p
                  style={{
                    margin: '3px 0 0 0',
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {selection.kind !== 'user' && <IconMapPin size={12} color="var(--color-text-dim)" />}
                  <span>{header.subtitle}</span>
                </p>
              )}
            </div>

            {header.coords && (
              <button
                type="button"
                className="admin-coord-readout"
                onClick={handleCopyCoords}
                title="Nhấn để sao chép tọa độ GPS (lat, lng)"
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '100%',
                  color: isCopied ? 'var(--color-primary)' : undefined,
                  borderColor: isCopied
                    ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)'
                    : undefined,
                }}
              >
                <CrosshairGlyph size={12} />
                <span>{formatCoordDisplay(header.coords.lat, header.coords.lng)}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    marginLeft: 4,
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    color: isCopied ? 'var(--color-primary)' : 'var(--color-text-dim)',
                  }}
                >
                  {isCopied ? (
                    <>
                      <IconCheck size={11} />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <IconCopy size={11} />
                  )}
                </span>
              </button>
            )}
          </div>

          <div className="admin-inspector-body">{renderBody()}</div>

          {footerContent && <div className="admin-inspector-foot">{footerContent}</div>}
        </aside>
      </>
    );
  }
);

AdminSpatialInspector.displayName = 'AdminSpatialInspector';
