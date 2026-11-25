import React, { useCallback, useMemo, useState } from 'react';
import type {
  AdminCockpitSectionId,
  CockpitBeaconPoint,
  CockpitContributionPoint,
  CockpitCoordPoint,
  CockpitIncidentPoint,
  CockpitInspectorSelection,
  CockpitOverdueTimerPoint,
  CockpitTrailPoint,
  CockpitTriageItem,
} from './adminCockpitTypes.js';
import { VietnamTacticalRadar } from './VietnamTacticalRadar.js';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBackpack,
  IconCheckCircle,
  IconCompass,
  IconFileText,
  IconMapPin,
  IconMessageSquare,
  IconMountain,
  IconPlus,
  IconRadio,
  IconShieldAlert,
  IconStar,
  IconUsers,
} from '../common/SvgIcons.js';

export interface AdminCommandDeckStats {
  totalUsers: number;
  totalTrails: number;
  pendingContributions: number;
  activeIncidents: number;
  activeSafetyTimers: number;
  totalReviews: number;
  totalThreads: number;
  totalCheckins: number;
  totalGuides: number;
  totalTripPlans: number;
  totalTripReports: number;
  urgentSafetyCount: number;
}

export interface AdminCommandDeckProps {
  trails: CockpitTrailPoint[];
  incidents: CockpitIncidentPoint[];
  beacons: CockpitBeaconPoint[];
  pendingContributions?: CockpitContributionPoint[];
  overdueTimers?: CockpitOverdueTimerPoint[];
  triageItems: CockpitTriageItem[];
  stats: AdminCommandDeckStats;
  selectedId?: string | null;
  onSelect: (selection: CockpitInspectorSelection) => void;
  onNavigateSection: (section: AdminCockpitSectionId, fieldSubTab?: 'pois' | 'reviews') => void;
  onPointerCoordChange?: (coords: CockpitCoordPoint | null) => void;
  onOpenContributeWizard: () => void;
  onOpenCreateTrail?: () => void;
  isStrictAdmin: boolean;
}

const getTriageKindLabel = (kind: CockpitTriageItem['kind']): string => {
  switch (kind) {
    case 'sos':
      return 'SOS';
    case 'overdue':
      return 'Quá hạn';
    case 'dispute':
      return 'Tranh chấp';
    case 'incident':
      return 'Sự cố';
    case 'contribution':
      return 'Đóng góp';
    case 'inquiry':
      return 'Yêu cầu';
  }
};

const getPriorityTagClass = (priority: 1 | 2 | 3): string => {
  if (priority === 1) return 'admin-tag admin-tag--danger';
  if (priority === 2) return 'admin-tag admin-tag--warn';
  return 'admin-tag admin-tag--info';
};

const truncateLabel = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
};

const normalizeRegionKey = (region?: string): 'north' | 'central' | 'south' => {
  const norm = (region || '').toLowerCase();
  if (norm.includes('trung') || norm.includes('tây nguyên') || norm.includes('tay nguyen')) {
    return 'central';
  }
  if (norm.includes('nam')) return 'south';
  return 'north';
};

interface PulseTileConfig {
  id: string;
  label: string;
  value: number;
  sub: string;
  target: AdminCockpitSectionId;
  fieldSubTab?: 'pois' | 'reviews';
  tone?: 'danger' | 'warn' | 'ok';
  icon: React.ReactNode;
}

export const AdminCommandDeck: React.FC<AdminCommandDeckProps> = React.memo(
  ({
    trails,
    incidents,
    beacons,
    pendingContributions = [],
    overdueTimers = [],
    triageItems,
    stats,
    selectedId,
    onSelect,
    onNavigateSection,
    onPointerCoordChange,
    onOpenContributeWizard,
    onOpenCreateTrail,
    isStrictAdmin,
  }) => {
    const [hoveredPeakId, setHoveredPeakId] = useState<string | null>(null);

    const readiness = useMemo(() => {
      if (stats.urgentSafetyCount > 0) {
        return {
          lampClass: 'admin-readiness-lamp admin-readiness-lamp--danger',
          label: 'Khẩn cấp SOS',
          textColor: 'var(--color-error-text, var(--color-error))',
        };
      }
      if (stats.activeIncidents + stats.pendingContributions > 0) {
        return {
          lampClass: 'admin-readiness-lamp admin-readiness-lamp--warn',
          label: 'Cần xử lý',
          textColor: 'var(--color-earth)',
        };
      }
      return {
        lampClass: 'admin-readiness-lamp admin-readiness-lamp--ok',
        label: 'Vận hành ổn định',
        textColor: 'var(--color-primary)',
      };
    }, [stats.activeIncidents, stats.pendingContributions, stats.urgentSafetyCount]);

    const activeBeaconsCount = useMemo(
      () => beacons.filter((b) => b.status === 'active' || b.status === 'sos').length,
      [beacons]
    );

    const sortedTriage = useMemo(
      () => [...triageItems].sort((a, b) => a.priority - b.priority),
      [triageItems]
    );

    const triageCounts = useMemo(() => {
      let p1 = 0;
      let p2 = 0;
      for (const item of sortedTriage) {
        if (item.priority === 1) p1 += 1;
        else if (item.priority === 2) p2 += 1;
      }
      return { p1, p2, total: sortedTriage.length };
    }, [sortedTriage]);

    const topPeaks = useMemo(() => {
      return [...trails]
        .filter((t) => typeof t.maxAltitudeM === 'number' && t.maxAltitudeM > 0)
        .sort((a, b) => b.maxAltitudeM - a.maxAltitudeM)
        .slice(0, 8);
    }, [trails]);

    const quickMonitorTrails = useMemo(() => topPeaks.slice(0, 5), [topPeaks]);

    const regionBreakdown = useMemo(() => {
      let north = 0;
      let central = 0;
      let south = 0;
      for (const trail of trails) {
        const key = normalizeRegionKey(trail.region);
        if (key === 'north') north += 1;
        else if (key === 'central') central += 1;
        else south += 1;
      }
      const total = Math.max(1, north + central + south);
      return {
        totalRaw: north + central + south,
        north,
        central,
        south,
        northPct: Math.round((north / total) * 100),
        centralPct: Math.round((central / total) * 100),
        southPct: Math.round((south / total) * 100),
      };
    }, [trails]);

    const pulseTiles: PulseTileConfig[] = useMemo(
      () => [
        {
          id: 'users',
          label: 'Thành viên',
          value: stats.totalUsers,
          sub: isStrictAdmin ? 'Tài khoản đã đăng ký' : 'Xem trong thống kê tổng quan',
          target: isStrictAdmin ? 'users' : 'stats',
          icon: <IconUsers size={15} />,
        },
        {
          id: 'trails',
          label: 'Cung đường',
          value: stats.totalTrails,
          sub: 'Đang hiển thị trên bản đồ',
          target: 'trails',
          tone: 'ok',
          icon: <IconCompass size={15} />,
        },
        {
          id: 'contributions',
          label: 'Chờ duyệt',
          value: stats.pendingContributions,
          sub: 'Đóng góp từ cộng đồng',
          target: 'contributions',
          tone: stats.pendingContributions > 0 ? 'warn' : undefined,
          icon: <IconFileText size={15} />,
        },
        {
          id: 'incidents',
          label: 'Sự cố',
          value: stats.activeIncidents,
          sub: 'Cảnh báo đang mở',
          target: 'incidents',
          tone: stats.activeIncidents > 0 ? 'danger' : undefined,
          icon: <IconAlertTriangle size={15} />,
        },
        {
          id: 'forum',
          label: 'Diễn đàn',
          value: stats.totalThreads,
          sub: 'Bài thảo luận',
          target: 'forum',
          icon: <IconMessageSquare size={15} />,
        },
        {
          id: 'reviews',
          label: 'Đánh giá',
          value: stats.totalReviews,
          sub: 'Nhận xét sau chuyến đi',
          target: 'field',
          fieldSubTab: 'reviews',
          icon: <IconStar size={15} />,
        },
        {
          id: 'checkins',
          label: 'Check-in',
          value: stats.totalCheckins,
          sub: 'Lượt ghi dấu đỉnh',
          target: 'stats',
          icon: <IconMapPin size={15} />,
        },
        {
          id: 'guides',
          label: 'Porter & HDV',
          value: stats.totalGuides,
          sub: 'Quản lý yêu cầu dẫn đường',
          target: 'inquiries',
          icon: <IconBackpack size={15} />,
        },
      ],
      [
        isStrictAdmin,
        stats.activeIncidents,
        stats.pendingContributions,
        stats.totalCheckins,
        stats.totalGuides,
        stats.totalReviews,
        stats.totalThreads,
        stats.totalTrails,
        stats.totalUsers,
      ]
    );

    const handleTriageClick = useCallback(
      (item: CockpitTriageItem) => {
        if (item.selection) {
          onSelect(item.selection);
        } else {
          onNavigateSection(item.targetSection);
        }
      },
      [onNavigateSection, onSelect]
    );

    const handlePeakSelect = useCallback(
      (trail: CockpitTrailPoint) => {
        onSelect({ kind: 'trail', data: trail });
      },
      [onSelect]
    );

    const handlePeakHover = useCallback(
      (trail: CockpitTrailPoint | null) => {
        setHoveredPeakId(trail ? trail.id : null);
        if (onPointerCoordChange) {
          if (trail && Number.isFinite(trail.startLat) && Number.isFinite(trail.startLng)) {
            onPointerCoordChange({ lat: trail.startLat, lng: trail.startLng });
          } else {
            onPointerCoordChange(null);
          }
        }
      },
      [onPointerCoordChange]
    );

    // SVG geometry constants for Vietnam Altitude Spectrum (Top 8 Peaks)
    const chartW = 540;
    const rowHeight = 25;
    const topPad = 14;
    const bottomPad = 20;
    const chartH = topPad + Math.max(1, topPeaks.length) * rowHeight + bottomPad;
    const labelW = 166;
    const valueW = 62;
    const barStartX = labelW;
    const barMaxW = chartW - labelW - valueW;
    const altitudeCeiling = Math.max(3200, topPeaks[0]?.maxAltitudeM ?? 3143);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 1. OPERATIONAL READINESS BAR */}
        <div className="admin-readiness-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className={readiness.lampClass} />
              <strong
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: readiness.textColor,
                }}
              >
                {readiness.label}
              </strong>
            </div>

            <span
              aria-hidden="true"
              style={{
                width: 1,
                height: 16,
                background: 'var(--color-border-strong)',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <button
                type="button"
                className="admin-tag"
                onClick={() => onNavigateSection('trails')}
                style={{ cursor: 'pointer' }}
              >
                <span className="admin-dot admin-dot--ok" />
                <span>{`${stats.totalTrails} cung đường`}</span>
              </button>
              <button
                type="button"
                className={stats.urgentSafetyCount > 0 ? 'admin-tag admin-tag--danger' : 'admin-tag'}
                onClick={() => onNavigateSection('safety')}
                style={{ cursor: 'pointer' }}
              >
                <IconRadio size={11} />
                <span>{`${activeBeaconsCount} tín hiệu trực tiếp · ${stats.activeSafetyTimers} hẹn giờ`}</span>
              </button>
              <button
                type="button"
                className={stats.activeIncidents > 0 ? 'admin-tag admin-tag--danger' : 'admin-tag'}
                onClick={() => onNavigateSection('incidents')}
                style={{ cursor: 'pointer' }}
              >
                <span>{`${stats.activeIncidents} sự cố`}</span>
              </button>
              <button
                type="button"
                className={stats.pendingContributions > 0 ? 'admin-tag admin-tag--warn' : 'admin-tag'}
                onClick={() => onNavigateSection('contributions')}
                style={{ cursor: 'pointer' }}
              >
                <span>{`${stats.pendingContributions} chờ duyệt`}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isStrictAdmin && onOpenCreateTrail ? (
              <>
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--ghost"
                  onClick={onOpenContributeWizard}
                >
                  <IconFileText size={13} />
                  <span>Đóng góp mới</span>
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={onOpenCreateTrail}
                >
                  <IconPlus size={13} />
                  <span>Thêm cung đường</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--primary"
                onClick={onOpenContributeWizard}
              >
                <IconPlus size={13} />
                <span>Đóng góp mới</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. ASYMMETRIC 2-COLUMN SPATIAL COCKPIT GRID */}
        <div className="admin-cockpit-grid">
          <VietnamTacticalRadar
            trails={trails}
            incidents={incidents}
            beacons={beacons}
            pendingContributions={pendingContributions}
            overdueTimers={overdueTimers}
            selectedId={selectedId}
            onSelect={onSelect}
            onPointerCoordChange={onPointerCoordChange}
          />

          {/* Right: Live Triage Queue */}
          <section className="admin-triage-panel" aria-label="Việc cần xử lý trước">
            <div className="admin-triage-head">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Việc cần xử lý trước
                </h2>
                <span style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)' }}>
                  Chọn từng mục để xem chi tiết bên phải
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {triageCounts.p1 > 0 && (
                  <span className="admin-tag admin-tag--danger">{`P1 · ${triageCounts.p1}`}</span>
                )}
                {triageCounts.p2 > 0 && (
                  <span className="admin-tag admin-tag--warn">{`P2 · ${triageCounts.p2}`}</span>
                )}
                <span className="admin-code">{triageCounts.total}</span>
              </div>
            </div>

            <div className="admin-triage-list">
              {sortedTriage.length > 0 ? (
                sortedTriage.map((item) => {
                  const isSelected = Boolean(selectedId && item.selection?.data.id === selectedId);
                  const priorityClass =
                    item.priority === 1
                      ? 'admin-triage-row--p1'
                      : item.priority === 2
                        ? 'admin-triage-row--p2'
                        : 'admin-triage-row--p3';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`admin-triage-row ${priorityClass}${isSelected ? ' is-selected' : ''}`}
                      onClick={() => handleTriageClick(item)}
                      onMouseEnter={() => {
                        if (
                          onPointerCoordChange &&
                          typeof item.lat === 'number' &&
                          typeof item.lng === 'number' &&
                          Number.isFinite(item.lat) &&
                          Number.isFinite(item.lng)
                        ) {
                          onPointerCoordChange({ lat: item.lat, lng: item.lng });
                        }
                      }}
                      onMouseLeave={() => {
                        if (onPointerCoordChange) onPointerCoordChange(null);
                      }}
                      style={{
                        background: isSelected
                          ? 'color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card))'
                          : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span className={getPriorityTagClass(item.priority)}>{`P${item.priority}`}</span>
                          <span className="admin-code" style={{ fontSize: '0.64rem' }}>
                            {getTriageKindLabel(item.kind)}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.69rem',
                            color: 'var(--color-text-dim)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {item.meta}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: 'var(--color-text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.73rem',
                              color: 'var(--color-text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: 2,
                            }}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                        <IconArrowRight size={13} color="var(--color-text-dim)" />
                      </div>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Calm compact all-clear telemetry readout */}
                  <div
                    style={{
                      padding: '12px 13px',
                      borderRadius: 5,
                      border: '1px solid color-mix(in srgb, var(--color-primary) 26%, transparent)',
                      background: 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-main))',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <IconCheckCircle size={17} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                        Các cung đường đang ổn định
                      </strong>
                      <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                        Chưa có tín hiệu SOS, khiếu nại hay cảnh báo khẩn nào cần xử lý.
                      </span>
                    </div>
                  </div>

                  {/* Quick-inspect top active Vietnam peaks so triage pane is always actionable */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-dim)',
                        }}
                      >
                        Các đỉnh tiêu biểu
                      </span>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--ghost"
                        onClick={() => onNavigateSection('trails')}
                        style={{ height: 24, padding: '0 6px', fontSize: '0.71rem' }}
                      >
                        <span>Xem tất cả</span>
                        <IconArrowRight size={11} />
                      </button>
                    </div>

                    <div className="admin-ledger">
                      {quickMonitorTrails.map((trail) => {
                        const isSel = selectedId === trail.id;
                        return (
                          <button
                            key={trail.id}
                            type="button"
                            className={`admin-triage-row admin-triage-row--p3${isSel ? ' is-selected' : ''}`}
                            onClick={() => handlePeakSelect(trail)}
                            onMouseEnter={() => handlePeakHover(trail)}
                            onMouseLeave={() => handlePeakHover(null)}
                            style={{
                              background: isSel
                                ? 'color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card))'
                                : undefined,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text-main)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {trail.name}
                                </div>
                                <div style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
                                  {`${trail.province} · ${trail.distanceKm} km`}
                                </div>
                              </div>
                              <span
                                className="admin-code"
                                style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}
                              >
                                {`${Math.round(trail.maxAltitudeM).toLocaleString('vi-VN')}m`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 3. BOTTOM ANALYTICS & PULSE DECK */}
        <div className="admin-analytics-grid">
          {/* Left: Vietnam Altitude Spectrum Chart */}
          <section className="admin-altitude-panel" aria-label="Cao độ các đỉnh núi Việt Nam">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconMountain size={15} color="var(--color-primary)" />
                  <span>Cao độ các đỉnh núi Việt Nam</span>
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                  8 cung đường cao nhất · chọn từng cung để xem chi tiết bên phải
                </p>
              </div>
              {topPeaks[0] && (
                <span
                  className="admin-tag admin-tag--ok"
                  style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                >
                  {`Đỉnh cao nhất: ${Math.round(topPeaks[0].maxAltitudeM).toLocaleString('vi-VN')} m`}
                </span>
              )}
            </div>

            {topPeaks.length > 0 ? (
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                width="100%"
                height={chartH}
                role="img"
                aria-label="Biểu đồ cao độ 8 đỉnh núi cao nhất Việt Nam"
                style={{ display: 'block', overflow: 'visible' }}
              >
                {/* Vertical elevation reference ticks (1000m, 2000m, 3000m) */}
                {[1000, 2000, 3000].map((tickAlt) => {
                  const x = barStartX + (tickAlt / altitudeCeiling) * barMaxW;
                  return (
                    <g key={tickAlt}>
                      <line
                        x1={x}
                        y1={topPad - 4}
                        x2={x}
                        y2={chartH - bottomPad + 2}
                        stroke="var(--color-border-strong)"
                        strokeWidth="0.75"
                        strokeDasharray="2.5 3.5"
                        opacity="0.5"
                      />
                      <text
                        x={x}
                        y={chartH - 5}
                        textAnchor="middle"
                        fill="var(--color-text-dim)"
                        fontSize="9.5"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {`${tickAlt.toLocaleString('vi-VN')}m`}
                      </text>
                    </g>
                  );
                })}

                {/* Interactive Top 8 horizontal elevation spectrum bars */}
                {topPeaks.map((trail, index) => {
                  const y = topPad + index * rowHeight;
                  const barW = Math.max(12, (trail.maxAltitudeM / altitudeCeiling) * barMaxW);
                  const isSelected = selectedId === trail.id;
                  const isHovered = hoveredPeakId === trail.id;
                  const isEmphasized = isSelected || isHovered;
                  const barColor =
                    trail.maxAltitudeM >= 2500
                      ? 'var(--color-primary)'
                      : trail.maxAltitudeM >= 1500
                        ? 'var(--color-sky)'
                        : 'var(--color-earth)';

                  return (
                    <g
                      key={trail.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${trail.name}, ${trail.province}, cao ${trail.maxAltitudeM} mét`}
                      onClick={() => handlePeakSelect(trail)}
                      onMouseEnter={() => handlePeakHover(trail)}
                      onMouseLeave={() => handlePeakHover(null)}
                      onFocus={() => handlePeakHover(trail)}
                      onBlur={() => handlePeakHover(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handlePeakSelect(trail);
                        }
                      }}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      {/* Row hover/selected highlight strip */}
                      <rect
                        x={0}
                        y={y}
                        width={chartW}
                        height={rowHeight - 3}
                        rx={3}
                        fill={barColor}
                        opacity={isSelected ? 0.12 : isHovered ? 0.07 : 0}
                      />

                      {/* Rank index */}
                      <text
                        x={6}
                        y={y + 14}
                        fill={isEmphasized ? barColor : 'var(--color-text-dim)'}
                        fontSize="9.5"
                        fontWeight="700"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </text>

                      {/* Peak name */}
                      <text
                        x={26}
                        y={y + 14}
                        fill={isEmphasized ? 'var(--color-text-main)' : 'var(--color-text-muted)'}
                        fontSize="10.5"
                        fontWeight={isEmphasized ? '700' : '500'}
                      >
                        {truncateLabel(trail.name, 20)}
                      </text>

                      {/* Track background rail */}
                      <rect
                        x={barStartX}
                        y={y + 6}
                        width={barMaxW}
                        height={9}
                        rx={2}
                        fill="var(--color-surface-elevated)"
                        opacity="0.7"
                      />

                      {/* Elevation magnitude bar */}
                      <rect
                        x={barStartX}
                        y={y + 6}
                        width={barW}
                        height={9}
                        rx={2}
                        fill={barColor}
                        opacity={isEmphasized ? 1 : 0.78}
                      />

                      {/* Summit diamond reticle cap at tip */}
                      <polygon
                        points={`${(barStartX + barW).toFixed(1)},${(y + 5).toFixed(1)} ${(barStartX + barW + 5).toFixed(1)},${(y + 10.5).toFixed(1)} ${(barStartX + barW).toFixed(1)},${(y + 16).toFixed(1)} ${(barStartX + barW - 5).toFixed(1)},${(y + 10.5).toFixed(1)}`}
                        fill={barColor}
                        stroke="var(--color-bg-card)"
                        strokeWidth="1"
                      />

                      {/* Right-aligned tabular altitude value */}
                      <text
                        x={chartW - 4}
                        y={y + 14}
                        textAnchor="end"
                        fill={isEmphasized ? 'var(--color-text-main)' : 'var(--color-text-muted)'}
                        fontSize="10.5"
                        fontWeight="700"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {`${Math.round(trail.maxAltitudeM).toLocaleString('vi-VN')}m`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-dim)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 5,
                }}
              >
                Đang tải dữ liệu cao độ các cung đường...
              </div>
            )}

            {/* 3-Region Breakdown Bar (Miền Bắc / Miền Trung / Miền Nam) */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  height: 7,
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: 'var(--color-surface-elevated)',
                  gap: 2,
                }}
                aria-label="Phân bổ cung đường theo 3 miền"
              >
                {regionBreakdown.north > 0 && (
                  <div
                    style={{
                      width: `${regionBreakdown.northPct}%`,
                      background: 'var(--color-primary)',
                    }}
                  />
                )}
                {regionBreakdown.central > 0 && (
                  <div
                    style={{
                      width: `${regionBreakdown.centralPct}%`,
                      background: 'var(--color-sky)',
                    }}
                  />
                )}
                {regionBreakdown.south > 0 && (
                  <div
                    style={{
                      width: `${regionBreakdown.southPct}%`,
                      background: 'var(--color-earth)',
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 8,
                  fontSize: '0.73rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: 'var(--color-primary)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--color-text-muted)' }}>Miền Bắc</span>
                  <strong style={{ color: 'var(--color-text-main)', marginLeft: 'auto' }}>
                    {`${regionBreakdown.north} (${regionBreakdown.northPct}%)`}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: 'var(--color-sky)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--color-text-muted)' }}>Miền Trung</span>
                  <strong style={{ color: 'var(--color-text-main)', marginLeft: 'auto' }}>
                    {`${regionBreakdown.central} (${regionBreakdown.centralPct}%)`}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: 'var(--color-earth)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--color-text-muted)' }}>Miền Nam</span>
                  <strong style={{ color: 'var(--color-text-main)', marginLeft: 'auto' }}>
                    {`${regionBreakdown.south} (${regionBreakdown.southPct}%)`}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Right: Operational Pulse Matrix (8 clickable telemetry tiles) */}
          <section className="admin-pulse-panel" aria-label="Tổng quan hoạt động">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconShieldAlert size={15} color="var(--color-primary)" />
                  <span>Tổng quan hoạt động</span>
                </h2>
                <p
                  style={{
                    margin: '3px 0 0 0',
                    fontSize: '0.72rem',
                    color: 'var(--color-text-dim)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`${stats.totalTripPlans.toLocaleString('vi-VN')} lịch trình ghép đoàn · ${stats.totalTripReports.toLocaleString('vi-VN')} nhật ký chuyến đi`}
                </p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--ghost"
                onClick={() => onNavigateSection('stats')}
                style={{ height: 26, padding: '0 7px', fontSize: '0.72rem' }}
              >
                <span>Thống kê</span>
                <IconArrowRight size={11} />
              </button>
            </div>

            <div className="admin-pulse-grid">
              {pulseTiles.map((tile) => {
                const valueColor =
                  tile.tone === 'danger'
                    ? 'var(--color-error-text, var(--color-error))'
                    : tile.tone === 'warn'
                      ? 'var(--color-earth)'
                      : tile.tone === 'ok'
                        ? 'var(--color-primary)'
                        : 'var(--color-text-main)';

                return (
                  <button
                    key={tile.id}
                    type="button"
                    className="admin-pulse-tile"
                    onClick={() => onNavigateSection(tile.target, tile.fieldSubTab)}
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        color: 'var(--color-text-dim)',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {tile.label}
                      </span>
                      <span style={{ color: valueColor, display: 'inline-flex' }}>{tile.icon}</span>
                    </div>

                    <strong
                      style={{
                        fontSize: '1.38rem',
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.15,
                        color: valueColor,
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 6,
                        display: 'block',
                      }}
                    >
                      {tile.value.toLocaleString('vi-VN')}
                    </strong>

                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--color-text-dim)',
                        marginTop: 3,
                        display: 'block',
                      }}
                    >
                      {tile.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }
);

AdminCommandDeck.displayName = 'AdminCommandDeck';
