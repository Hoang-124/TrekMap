import React, { useState, useEffect, useMemo } from 'react';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
  IconMountain,
  IconMapPin,
} from '../common/SvgIcons.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { mockTrails } from '../../data/seedData.js';
import type { UserProfile } from '../../types.js';
import type { TripPlanItem } from './TripPlanCard.js';
import { SquadWorkspaceModal } from './SquadWorkspaceModal.js';

interface ExpeditionCalendarGridProps {
  trips: TripPlanItem[];
  currentUser?: UserProfile | null;
  onTripUpdated?: () => void;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const REGION_OPTIONS = ['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'] as const;

function toLocalDateKey(dateLike: string | Date): string | null {
  const d = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDifficultyColor(level?: number): string {
  const lvl = Number(level) || 3;
  if (lvl >= 5) return 'var(--color-error)';
  if (lvl === 4) return 'var(--color-earth)';
  if (lvl === 3) return 'var(--color-sky)';
  return 'var(--color-primary)';
}

function resolveTripRegion(trip: TripPlanItem): string {
  if (trip.region) return trip.region;
  if (trip.trailId && typeof trip.trailId === 'object' && trip.trailId.region) {
    return trip.trailId.region;
  }
  const needle = (trip.trailName || trip.title || '').toLowerCase();
  if (needle) {
    const match = mockTrails.find(
      (t) =>
        needle.includes(t.name.toLowerCase()) ||
        (t.altNames || []).some((a) => needle.includes(a.toLowerCase())) ||
        needle.includes(t.province.toLowerCase())
    );
    if (match) return match.region;
  }
  return '';
}

type CalendarTripRecord = TripPlanItem & {
  memberCount?: number;
  seatsLeft?: number;
  creator?: { _id?: string };
};

function extractCalendarTrips(json: unknown): TripPlanItem[] | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const payload = (root.data ?? root) as unknown;
  if (Array.isArray(payload)) return payload as TripPlanItem[];
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.trips)) return obj.trips as TripPlanItem[];
  if (Array.isArray(obj.items)) return obj.items as TripPlanItem[];
  if (obj.days && typeof obj.days === 'object') {
    const collected: TripPlanItem[] = [];
    Object.values(obj.days as Record<string, unknown>).forEach((entry) => {
      if (Array.isArray(entry)) {
        collected.push(...(entry as TripPlanItem[]));
      } else if (entry && typeof entry === 'object' && Array.isArray((entry as Record<string, unknown>).trips)) {
        collected.push(...((entry as Record<string, unknown>).trips as TripPlanItem[]));
      }
    });
    return collected;
  }
  return null;
}

function getTripSeatMetrics(trip: CalendarTripRecord): { memberCount: number; maxCount: number; seatsLeft: number } {
  const maxCount = Math.max(1, Number(trip.maxMembers) || 8);
  const memberCount =
    typeof trip.memberCount === 'number'
      ? trip.memberCount
      : Array.isArray(trip.currentMembers)
        ? trip.currentMembers.length
        : 1;
  const seatsLeft =
    typeof trip.seatsLeft === 'number'
      ? Math.max(0, trip.seatsLeft)
      : Math.max(0, maxCount - memberCount);
  return { memberCount, maxCount, seatsLeft };
}

export const ExpeditionCalendarGrid: React.FC<ExpeditionCalendarGridProps> = ({
  trips,
  currentUser,
  onTripUpdated,
}) => {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1..12
  const [regionFilter, setRegionFilter] = useState<(typeof REGION_OPTIONS)[number]>('All');
  const [serverCalendarTrips, setServerCalendarTrips] = useState<TripPlanItem[] | null>(null);
  const [loadedCalendarKey, setLoadedCalendarKey] = useState<string>('');
  const [selectedTrip, setSelectedTrip] = useState<TripPlanItem | null>(null);

  const currentUserId = String(currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '');
  const calendarQueryKey = `${viewYear}-${viewMonth}-${regionFilter}-${trips.length}`;
  const loadingCalendar = loadedCalendarKey !== calendarQueryKey;

  // Query GET /api/trips/calendar?year=&month=&region= with graceful fallback to client grouping
  useEffect(() => {
    const controller = new AbortController();
    const requestKey = `${viewYear}-${viewMonth}-${regionFilter}-${trips.length}`;

    const qs = new URLSearchParams({
      year: String(viewYear),
      month: String(viewMonth),
    });
    if (regionFilter !== 'All') {
      qs.set('region', regionFilter);
    }

    fetch(`/api/trips/calendar?${qs.toString()}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        const parsed = json?.success ? extractCalendarTrips(json) : null;
        setServerCalendarTrips(parsed);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setServerCalendarTrips(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedCalendarKey(requestKey);
      });

    return () => controller.abort();
  }, [viewYear, viewMonth, regionFilter, trips.length]);

  // Active trips for this month (server calendar result if available, otherwise client-grouped fallback)
  const monthTrips = useMemo(() => {
    const source = serverCalendarTrips !== null ? serverCalendarTrips : trips;
    return source.filter((trip) => {
      const start = new Date(trip.startDate);
      if (Number.isNaN(start.getTime())) return false;
      const sameMonth = start.getFullYear() === viewYear && start.getMonth() + 1 === viewMonth;
      if (!sameMonth) return false;
      if (regionFilter !== 'All') {
        const reg = resolveTripRegion(trip);
        if (reg && reg !== regionFilter) return false;
      }
      return true;
    });
  }, [serverCalendarTrips, trips, viewYear, viewMonth, regionFilter]);

  // Group departures by YYYY-MM-DD
  const tripsByDay = useMemo(() => {
    const map = new Map<string, TripPlanItem[]>();
    monthTrips.forEach((trip) => {
      const key = toLocalDateKey(trip.startDate);
      if (!key) return;
      const list = map.get(key) || [];
      list.push(trip);
      map.set(key, list);
    });
    return map;
  }, [monthTrips]);

  // Build Mon-first calendar grid cells
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    // JS getDay(): 0=Sun..6=Sat -> convert to Mon=0..Sun=6
    const startOffset = (firstOfMonth.getDay() + 6) % 7;

    const cells: Array<{ day: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateKey: key });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateKey: null });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const todayKey = toLocalDateKey(now);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const matchedFullTrip: CalendarTripRecord | null = selectedTrip
    ? (trips.find((t) => String(t._id) === String(selectedTrip._id)) || selectedTrip)
    : null;
  const rawCreator = matchedFullTrip?.creatorId;
  const selectedCreatorId = String(
    (typeof rawCreator === 'object' && rawCreator ? rawCreator._id : rawCreator) ||
      matchedFullTrip?.creator?._id ||
      ''
  );
  const selectedIsCreator = Boolean(selectedTrip && currentUserId && selectedCreatorId === currentUserId);
  const selectedIsMember = Boolean(
    selectedIsCreator ||
      (matchedFullTrip &&
        currentUserId &&
        Array.isArray(matchedFullTrip.currentMembers) &&
        matchedFullTrip.currentMembers.some((m) => {
          const memberId = typeof m === 'string' ? m : m?._id || m?.id || '';
          return String(memberId) === currentUserId;
        }))
  );
  const selectedMetrics = matchedFullTrip ? getTripSeatMetrics(matchedFullTrip) : { memberCount: 1, maxCount: 8, seatsLeft: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Calendar Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 16px',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Tháng trước"
            className="btn btn-outline"
            style={{ padding: '6px 8px', borderRadius: 4 }}
          >
            <IconChevronLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 145, justifyContent: 'center' }}>
            <IconCalendar size={15} color="var(--color-primary)" />
            <strong style={{ fontSize: '0.94rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
              Tháng {String(viewMonth).padStart(2, '0')} / {viewYear}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Tháng sau"
            className="btn btn-outline"
            style={{ padding: '6px 8px', borderRadius: 4 }}
          >
            <IconChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setViewYear(now.getFullYear());
              setViewMonth(now.getMonth() + 1);
            }}
            className="btn btn-outline"
            style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, fontWeight: 700 }}
          >
            Hôm nay
          </button>
        </div>

        {/* Region Filter Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {REGION_OPTIONS.map((reg) => {
            const active = regionFilter === reg;
            return (
              <button
                key={reg}
                type="button"
                onClick={() => setRegionFilter(reg)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: active ? 'var(--color-primary)' : 'var(--color-bg-main)',
                  color: active ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                }}
              >
                {reg === 'All' ? 'Toàn quốc' : reg}
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty Color Legend & Month Count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: '0.74rem',
          color: 'var(--color-text-muted)',
          padding: '0 2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-primary)' }} />
            Cấp 1–2 (Dễ)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-sky)' }} />
            Cấp 3 (Vừa)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-earth)' }} />
            Cấp 4 (Thử thách)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-error)' }} />
            Cấp 5 (Khắc nghiệt)
          </span>
        </div>

        <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
          {loadingCalendar ? 'Đang tải lịch...' : `${monthTrips.length} chuyến khởi hành trong tháng`}
        </span>
      </div>

      {/* Responsive Scrollable Calendar Grid */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 640 }}>
          {/* Weekday Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
            }}
          >
            {WEEKDAY_LABELS.map((dayName) => (
              <div
                key={dayName}
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            }}
          >
            {calendarCells.map((cell, idx) => {
              const dayTrips = cell.dateKey ? tripsByDay.get(cell.dateKey) || [] : [];
              const isToday = Boolean(cell.dateKey && cell.dateKey === todayKey);

              return (
                <div
                  key={cell.dateKey || `empty-${idx}`}
                  style={{
                    minHeight: 96,
                    padding: 6,
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--color-border)' : 'none',
                    borderBottom: idx < calendarCells.length - 7 ? '1px solid var(--color-border)' : 'none',
                    background:
                      cell.day === null
                        ? 'color-mix(in srgb, var(--color-bg-main) 60%, transparent)'
                        : isToday
                          ? 'color-mix(in srgb, var(--color-primary) 7%, transparent)'
                          : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {cell.day !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: isToday ? 800 : 600,
                          color: isToday ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                          background: isToday ? 'var(--color-primary)' : 'transparent',
                          borderRadius: 3,
                          padding: isToday ? '1px 6px' : '0 2px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {cell.day}
                      </span>
                      {dayTrips.length > 0 && (
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {dayTrips.length} đoàn
                        </span>
                      )}
                    </div>
                  )}

                  {dayTrips.map((trip) => {
                    const { seatsLeft } = getTripSeatMetrics(trip);
                    const diffColor = getDifficultyColor(trip.difficultyLevel);

                    return (
                      <button
                        key={trip._id}
                        type="button"
                        onClick={() => setSelectedTrip(trip)}
                        title={`${trip.title} — ${seatsLeft === 0 ? 'Hết chỗ' : `Còn ${seatsLeft} chỗ`} — Bấm mở Không Gian Đoàn`}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderRadius: 3,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderLeft: `3px solid ${diffColor}`,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: 'var(--color-text-main)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {trip.trailName || trip.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: seatsLeft === 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {seatsLeft === 0 ? 'Hết chỗ' : `Còn ${seatsLeft} chỗ`} • Cấp {trip.difficultyLevel || 3}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compact Departure Agenda Strip for the Selected Month */}
      {monthTrips.length > 0 ? (
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Lịch xuất phát tháng {viewMonth}/{viewYear} — bấm để mở Không Gian Đoàn
          </div>
          {monthTrips.map((trip) => {
            const { maxCount, seatsLeft } = getTripSeatMetrics(trip);
            const diffColor = getDifficultyColor(trip.difficultyLevel);

            return (
              <button
                key={trip._id}
                type="button"
                onClick={() => setSelectedTrip(trip)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `3px solid ${diffColor}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(trip.startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {trip.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.72rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                    {trip.trailName && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconMountain size={12} color="var(--color-sky)" />
                        {trip.trailName}
                      </span>
                    )}
                    {trip.meetingPoint && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconMapPin size={12} color="var(--color-earth)" />
                        {trip.meetingPoint}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: seatsLeft === 0 ? 'var(--banner-danger-bg)' : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                      color: seatsLeft === 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                      border: `1px solid ${seatsLeft === 0 ? 'var(--banner-danger-border)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconUsers size={12} />
                    {seatsLeft === 0 ? 'Hết chỗ' : `Còn ${seatsLeft}/${maxCount} chỗ`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--color-bg-card)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 4,
            color: 'var(--color-text-dim)',
            fontSize: '0.82rem',
          }}
        >
          Chưa có lịch khởi hành nào trong Tháng {viewMonth}/{viewYear}
          {regionFilter !== 'All' ? ` tại khu vực ${regionFilter}` : ''}.
        </div>
      )}

      {selectedTrip && (
        <SquadWorkspaceModal
          tripId={selectedTrip._id}
          tripTitle={selectedTrip.title}
          memberCount={selectedMetrics.memberCount}
          isCreator={selectedIsCreator}
          isMember={selectedIsMember}
          isOpen={Boolean(selectedTrip)}
          onClose={() => setSelectedTrip(null)}
          onTripUpdated={onTripUpdated}
          onShowToast={(message, type) => {
            window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
          }}
        />
      )}
    </div>
  );
};
