import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Trail } from '../../types.js';
import { fetchNearbyTrails, reverseGeocode } from '../../services/api.js';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d}
    </svg>
  );
};

const ChevronDown = createSvgIcon(<polyline points="6 9 12 15 18 9" />);
const Layers = createSvgIcon(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>);
const Check = createSvgIcon(<polyline points="20 6 9 17 4 12" />);
const Filter = createSvgIcon(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);
const Activity = createSvgIcon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const AlertTriangle = createSvgIcon(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
const X = createSvgIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);

// Fix default leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper for trail difficulty color scheme
export const getDifficultyColor = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) return '#ef4444'; // Red (Khó - Level 4, 5)
  if (diff === 3) return '#ffd600'; // Bright Vivid Yellow (Trung Bình - Level 3)
  return '#10b981'; // Fresh Emerald Green (Dễ - Level 1, 2)
};

export const getDifficultyInfo = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) {
    return {
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.8)',
      label: 'Khó',
    };
  }
  if (diff === 3) {
    return {
      color: '#ffd600',
      glow: 'rgba(255, 214, 0, 0.85)',
      label: 'Trung Bình',
    };
  }
  return {
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.8)',
    label: 'Dễ',
  };
};

// Tactical Helper to match an incident to a trail by ID or normalized name
export const matchTrailIncident = (trail: Trail, incidents: any[] = []) => {
  if (!incidents || incidents.length === 0) return undefined;
  const tid = trail.id || (trail as any)._id;
  return incidents.find((inc) => {
    if (!inc) return false;
    if (inc.trailId && (inc.trailId === tid || inc.trailId === trail.id)) return true;
    if (inc.trailName && trail.name) {
      const normInc = inc.trailName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTrail = trail.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normInc.includes(normTrail) || normTrail.includes(normInc)) return true;
    }
    return false;
  });
};

// Super lightweight SVG Teardrop Pin with white border & center dot (Google Maps style)
export const createTrailSvgIcon = (trail: Trail, incident?: any) => {
  const diffInfo = getDifficultyInfo(trail.difficultyLevel);

  const hasAlert = !!incident;
  const severity = incident?.severity || 'high';
  const alertColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#eab308';

  const alertBadgeHtml = hasAlert ? `
    <div class="trail-pin-alert-badge" style="
      position: absolute;
      top: -6px;
      right: -7px;
      width: 20px;
      height: 20px;
      background: ${alertColor};
      border: 2.2px solid #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 14px ${alertColor}, 0 3px 8px rgba(0, 0, 0, 0.85);
      z-index: 50;
      pointer-events: none;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="13"/>
        <circle cx="12" cy="18" r="1.5" fill="#ffffff" stroke="none"/>
      </svg>
    </div>
  ` : '';

  const radarRingHtml = hasAlert ? `
    <div style="
      position: absolute;
      top: 15px;
      left: 15px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid ${alertColor};
      background: ${alertColor}18;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
      animation: warningRadarPulse 1.8s infinite cubic-bezier(0.25, 1, 0.5, 1);
    "></div>
  ` : '';

  const customSvg = `
    <div class="trail-pin-node" style="
      position: relative;
      width: 30px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      ${radarRingHtml}
      <!-- Teardrop Map Pin SVG matching user reference photo -->
      <svg class="trail-teardrop-svg" width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 8px ${hasAlert ? alertColor : diffInfo.glow});
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: visible;
        position: relative;
        z-index: 1;
      ">
        <!-- Teardrop Shape with Color categorized by Difficulty -->
        <path
          d="M15 1.5C7.5 1.5 1.5 7.5 1.5 15C1.5 24.8 13.6 36.8 14.5 37.7C14.8 38 15.2 38 15.5 37.7C16.4 36.8 28.5 24.8 28.5 15C28.5 7.5 22.5 1.5 15 1.5Z"
          fill="${diffInfo.color}"
          stroke="#ffffff"
          stroke-width="2.4"
          stroke-linejoin="round"
        />

        <!-- Inner White Circle Core (like reference photo) -->
        <circle cx="15" cy="15" r="5.2" fill="#ffffff" />
      </svg>

      <!-- Alert Badge directly overlaying the pin in front -->
      ${alertBadgeHtml}
    </div>
  `;

  return L.divIcon({
    html: customSvg,
    className: 'custom-trail-svg-marker',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
};

// Tactical Auto-Positioned Hover Tooltip Component (Flips automatically to prevent boundary clipping)
export const TacticalTrailTooltip: React.FC<{
  trail: Trail;
  incident?: any;
  onSelect?: () => void;
}> = ({ trail, incident, onSelect }) => {
  const diffInfo = getDifficultyInfo(trail.difficultyLevel);
  const hasAlert = !!incident;
  const severity = incident?.severity || 'high';
  const alertColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#eab308';

  return (
    <div
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      style={{
        width: 318,
        maxWidth: 'calc(100vw - 32px)',
        background: 'linear-gradient(180deg, rgba(13, 22, 42, 0.98) 0%, rgba(6, 11, 24, 0.99) 100%)',
        border: '1.5px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 18,
        padding: '14px 16px',
        boxShadow: '0 24px 60px -8px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 32px rgba(16, 185, 129, 0.12)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        color: 'var(--color-text-main)',
        textAlign: 'left',
        fontFamily: "var(--font-family), 'Plus Jakarta Sans', 'Inter', 'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        cursor: onSelect ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {/* Top Badges Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        {/* Difficulty Pill with Glowing LED */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 14,
            background: `${diffInfo.color}18`,
            border: `1px solid ${diffInfo.color}45`,
            fontSize: '10.5px',
            fontWeight: 800,
            color: diffInfo.color,
            letterSpacing: '0.1px',
          }}
        >
          <span
            style={{
              width: 6.5,
              height: 6.5,
              borderRadius: '50%',
              background: diffInfo.color,
              boxShadow: `0 0 8px ${diffInfo.color}`,
              display: 'inline-block',
            }}
          />
          <span>{diffInfo.label} ({trail.difficultyLevel}/5)</span>
        </div>

        {/* Location Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--color-text-dim)',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '3px 9px',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            maxWidth: 155,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{trail.province}{trail.district ? `, ${trail.district}` : ''}</span>
        </div>
      </div>

      {/* Trail Name Title - Safe Unicode without negative letter-spacing */}
      <div
        style={{
          fontSize: '13.5px',
          fontWeight: 800,
          color: '#ffffff',
          lineHeight: 1.4,
          marginBottom: 10,
          letterSpacing: '0px',
          wordBreak: 'break-word',
        }}
      >
        {trail.name}
      </div>

      {/* Telemetry Bento Grid - 3 Sleek Glass Tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '7px 4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '8.5px', color: 'rgba(148, 163, 184, 0.85)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Quãng đường
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
            {trail.distanceKm || '--'} km
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '7px 4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '8.5px', color: 'rgba(148, 163, 184, 0.85)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Cao độ
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
            {trail.maxAltitudeM || '--'}m
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '7px 4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '8.5px', color: 'rgba(148, 163, 184, 0.85)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Thời gian
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#facc15', marginTop: 2 }}>
            {trail.durationDays ? trail.durationDays + 'N' : '1-2N'}
          </div>
        </div>
      </div>

      {/* Safety Alert Callout Banner */}
      {hasAlert && (
        <div
          style={{
            marginBottom: 10,
            padding: '9px 11px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.07) 100%)',
            border: `1.5px solid ${alertColor}66`,
            borderRadius: 12,
            boxShadow: `0 0 16px ${alertColor}22`,
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '10px', fontWeight: 800, color: alertColor }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: alertColor,
                  boxShadow: `0 0 8px ${alertColor}`,
                  display: 'inline-block',
                }}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              CẢNH BÁO AN TOÀN
            </span>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 800,
                background: alertColor,
                color: '#041108',
                padding: '1px 6px',
                borderRadius: 5,
                textTransform: 'uppercase',
              }}
            >
              {severity === 'critical' ? 'Khẩn cấp' : severity === 'high' ? 'Nguy cấp' : 'Chú ý'}
            </span>
          </div>
          <div style={{ fontSize: '10.5px', color: '#fecaca', fontWeight: 500, lineHeight: 1.45, wordBreak: 'break-word' }}>
            {incident.description || 'Có sự cố an toàn trên cung đường'}
          </div>
        </div>
      )}

      {/* Interactive Action Bar Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: 'var(--color-primary)',
          fontSize: '11px',
          fontWeight: 800,
          transition: 'all 0.15s ease',
        }}
      >
        <span>Nhấp để xem chi tiết & trắc diện 3D</span>
        <span style={{ fontSize: '12px' }}>➔</span>
      </div>
    </div>
  );
};

// Tactical Incidents Quick Inspection Drawer / Floating Command Panel
export const TacticalIncidentsDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  alertTrails: Array<{ trail: Trail; incident: any }>;
  onFlyTo: (trail: Trail) => void;
  onSelectTrail?: (trail: Trail) => void;
  onFilterAlerts: () => void;
  isFilterActive: boolean;
}> = ({ isOpen, onClose, alertTrails, onFlyTo, onSelectTrail, onFilterAlerts, isFilterActive }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 18,
        width: 370,
        maxWidth: 'calc(100% - 36px)',
        maxHeight: 'calc(100% - 80px)',
        background: 'var(--color-bg-card)',
        backdropFilter: 'blur(28px)',
        border: '1.5px solid rgba(239, 68, 68, 0.4)',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 20px rgba(239, 68, 68, 0.15)',
        zIndex: 1002,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.03) 100%)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '-0.2px' }}>
              Điểm Cảnh Báo An Toàn
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
              {alertTrails.length} cung đường có thông báo an toàn thực địa
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng cảnh báo"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: 8,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
            e.currentTarget.style.color = 'var(--color-text-main)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--color-text-muted)';
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Filter Toggle Subheader */}
      <div
        style={{
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
          {isFilterActive ? 'Đang lọc riêng các điểm cảnh báo' : 'Hiển thị tất cả trên bản đồ'}
        </span>
        <button
          type="button"
          onClick={onFilterAlerts}
          style={{
            background: isFilterActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            border: isFilterActive ? '1px solid #ef4444' : '1px solid var(--color-border)',
            color: isFilterActive ? '#ef4444' : 'var(--color-text-main)',
            borderRadius: 8,
            padding: '3px 8px',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isFilterActive ? 'Bỏ lọc cảnh báo' : 'Lọc riêng cảnh báo'}
        </button>
      </div>

      {/* Alert Items List */}
      <div
        style={{
          padding: 12,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 380,
        }}
      >
        {alertTrails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-dim)' }}>
            <div style={{ display: 'inline-flex', marginBottom: 8, color: '#10b981' }}>
              <ShieldCheck size={28} />
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Không có cảnh báo an toàn nào
            </div>
            <div style={{ fontSize: '0.72rem', marginTop: 4, color: 'var(--color-text-dim)' }}>
              Mọi cung đường hiện đang ở trạng thái ổn định và thông tuyến bình thường.
            </div>
          </div>
        ) : (
          alertTrails.map(({ trail, incident }) => {
            const severity = incident?.severity || 'high';
            const alertColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#eab308';

            return (
              <div
                key={trail.id || trail.name}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: `1px solid ${alertColor}55`,
                  borderRadius: 14,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Title & Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                      {trail.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                      {trail.province}{trail.district ? `, ${trail.district}` : ''} • {trail.region}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      background: alertColor,
                      color: '#041108',
                      padding: '2px 7px',
                      borderRadius: 6,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {severity === 'critical' ? 'Khẩn cấp' : severity === 'high' ? 'Nguy cấp' : 'Chú ý'}
                  </span>
                </div>

                {/* Incident Description */}
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: '#fecaca',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderLeft: `3px solid ${alertColor}`,
                    padding: '6px 8px',
                    borderRadius: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {incident.description || 'Có thông báo cảnh báo an toàn thực địa trên cung đường này.'}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => onFlyTo(trail)}
                    style={{
                      flex: 1,
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: 'var(--color-sky)',
                      borderRadius: 10,
                      padding: '6px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(56, 189, 248, 0.28)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                    }}
                  >
                    <span>Bay đến vị trí</span>
                    <span style={{ fontSize: '11px' }}>➔</span>
                  </button>

                  {onSelectTrail && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTrail(trail);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(74, 222, 128, 0.15)',
                        border: '1px solid rgba(74, 222, 128, 0.4)',
                        color: 'var(--color-primary)',
                        borderRadius: 10,
                        padding: '6px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(74, 222, 128, 0.28)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
                      }}
                    >
                      <span>Chi tiết cung</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// User GPS Pulse Location Marker Icon Helper
const createUserGpsIcon = () => {
  const customSvg = `
    <div style="
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(56, 189, 248, 0.35);
        border: 1.5px solid #38bdf8;
      "></div>
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #38bdf8;
        border: 3px solid #ffffff;
        box-shadow: 0 0 14px #38bdf8;
      "></div>
    </div>
  `;

  return L.divIcon({
    html: customSvg,
    className: 'user-gps-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });
};

// Start & Finish Peak Marker Icon Helper for GPX Polylines (Sleek Strava/AllTrails Style)
const createStartEndIcon = (type: 'start' | 'finish', label?: string) => {
  const isStart = type === 'start';
  const color = isStart ? '#10b981' : '#f59e0b';
  const iconSvg = isStart
    ? '<svg width="8" height="8" viewBox="0 0 24 24" fill="#10b981"><circle cx="12" cy="12" r="10"/></svg>'
    : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
  const text = label || (isStart ? 'Khởi hành' : 'Đỉnh');

  const html = `
    <div class="marker-hover-anim" style="
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      border: 1px solid ${color};
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      border-radius: 12px;
      padding: 2px 7px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
      line-height: 1.2;
    ">
      <span style="display: flex; align-items: center;">${iconSvg}</span>
      <span style="letter-spacing: 0.2px;">${text}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'start-finish-marker',
    iconSize: [70, 20],
    iconAnchor: [35, 24],
  });
};

export const createWaypointIcon = (type: string) => {
  let badgeColor = '#4ade80';
  let bgGlow = 'rgba(74, 222, 128, 0.4)';
  let iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  if (type === 'campsite') {
    badgeColor = '#38bdf8';
    bgGlow = 'rgba(56, 189, 248, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20 10 4"/><path d="m5 20 9-16"/><path d="M3 20h18"/><path d="m12 15-3 5h6z"/></svg>';
  } else if (type === 'water') {
    badgeColor = '#22d3ee';
    bgGlow = 'rgba(34, 211, 238, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>';
  } else if (type === 'viewpoint') {
    badgeColor = '#facc15';
    bgGlow = 'rgba(250, 204, 21, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
  } else if (type === 'danger') {
    badgeColor = '#ef4444';
    bgGlow = 'rgba(239, 68, 68, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }

  const html = `
    <div class="marker-hover-anim" style="
      background: rgba(15, 24, 46, 0.94);
      backdrop-filter: blur(12px);
      border: 1.5px solid ${badgeColor};
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px ${bgGlow};
      cursor: pointer;
    ">
      ${iconSvg}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'waypoint-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

// Rich Interactive Trail Popup with Live Realtime Weather & Safety Alert
export const TrailPopupContent: React.FC<{ trail: Trail; incident?: any; onSelect: () => void }> = ({ trail, incident, onSelect }) => {
  const [weather, setWeather] = useState<{ temp: number; condition: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch(`/api/weather/forecast?lat=${trail.startLat}&lng=${trail.startLng}`);
        const json = await res.json();
        if (isMounted && json.success && json.data && json.data.length > 0) {
          const today = json.data[0];
          const condMap: Record<string, string> = {
            clear: 'Trời trong',
            cloudy: 'Nhiều mây',
            foggy: 'Sương mù',
            rainy: 'Mưa rào',
            storm: 'Bão dông',
          };
          setWeather({
            temp: Math.round((today.tempMinC + today.tempMaxC) / 2),
            condition: condMap[today.weatherCondition] || 'Thời tiết tốt',
          });
        }
      } catch (err) {}
    };
    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [trail.startLat, trail.startLng]);

  const severity = incident?.severity || 'high';
  const alertColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#eab308';

  return (
    <div style={{ width: 270, padding: '4px 2px' }}>
      <div
        style={{
          position: 'relative',
          height: 130,
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <img
          src={trail.coverImage}
          alt={trail.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: getDifficultyColor(trail.difficultyLevel),
            color: '#041108',
            fontWeight: 800,
            fontSize: '0.72rem',
            padding: '3px 9px',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          Mức khó: {trail.difficultyLevel}/5
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'var(--color-bg-glass)',
            color: 'var(--color-primary)',
            fontWeight: 800,
            fontSize: '0.72rem',
            padding: '3px 9px',
            borderRadius: 12,
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border)',
          }}
        >
          {trail.region}
        </div>
      </div>

      <h4
        style={{
          margin: '0 0 8px 0',
          fontSize: '0.96rem',
          fontWeight: 800,
          color: 'var(--color-text-main)',
          lineHeight: 1.35,
          letterSpacing: '-0.015em',
        }}
      >
        {trail.name}
      </h4>

      {/* ⚠️ Incident Warning Alert Banner */}
      {incident && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.16)',
            border: `1px solid ${alertColor}`,
            borderRadius: 10,
            padding: '8px 10px',
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: alertColor, fontSize: '0.76rem' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Cảnh Báo Thực Địa</span>
            </span>
            <span style={{
              fontSize: '0.62rem',
              background: alertColor,
              color: '#041108',
              padding: '1px 6px',
              borderRadius: 4,
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              {severity === 'critical' ? 'Khẩn cấp' : severity === 'high' ? 'Nguy cấp' : 'Chú ý'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#fecaca', lineHeight: 1.35 }}>
            {incident.description}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 4,
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '7px 8px',
          borderRadius: 10,
          textAlign: 'center',
          marginBottom: 8,
          border: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Độ dài</div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{trail.distanceKm} km</strong>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Tích lũy</div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--color-sky)' }}>+{trail.elevationGainM}m</strong>
        </div>
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Thời gian</div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--color-sun)' }}>{trail.durationDays}N</strong>
        </div>
      </div>

      {weather && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 10,
            padding: '5px 10px',
            fontSize: '0.74rem',
            color: 'var(--color-sky)',
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
            <span>{weather.condition}</span>
          </span>
          <span>{weather.temp}°C</span>
        </div>
      )}

      <button
        type="button"
        onClick={onSelect}
        style={{
          width: '100%',
          background: 'var(--color-primary)',
          color: 'var(--color-bg-main)',
          border: 'none',
          borderRadius: 12,
          padding: '9px 12px',
          fontWeight: 800,
          fontSize: '0.78rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: 'var(--shadow-sprout)',
          transition: 'transform 0.15s ease',
        }}
      >
        <span>Xem Chi Tiết Cung Đường ➔</span>
      </button>
    </div>
  );
};

export interface MapViewProps {
  trails: Trail[];
  selectedTrail?: Trail | null;
  onSelectTrail?: (trail: Trail) => void;
  incidents?: any[];
  height?: string;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  allTrails?: Trail[];
  onSelectRegion?: (region: string) => void;
}

// Map Tile Providers (ToS-compliant open-source tile layers)
const TILE_PROVIDERS = {
  satellite: {
    name: 'Vệ Tinh (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
  },
  terrain: {
    name: 'Địa Hình (OpenTopoMap)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
  },
  roadmap: {
    name: 'Đường Phố (OpenStreetMap)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Controller to auto-center map when selected trail changes or user locates and preserve zoom/center on tile switch
const MapController: React.FC<{
  selectedTrail?: Trail | null;
  flyToPos?: [number, number] | null;
  flyToZoom?: number;
  currentTileKey?: string;
  isLiveTracking?: boolean;
}> = ({ selectedTrail, flyToPos, flyToZoom, currentTileKey, isLiveTracking }) => {
  const map = useMap();
  const prevTileRef = useRef(currentTileKey);

  // Invalidate map size on mount and window resize to eliminate tile gaps
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (flyToPos) {
      if (isLiveTracking) {
        map.panTo(flyToPos, { animate: true, duration: 0.8 });
      } else {
        map.flyTo(flyToPos, flyToZoom ?? 13, { duration: 1.5 });
      }
    } else if (selectedTrail) {
      map.flyTo([selectedTrail.startLat, selectedTrail.startLng], 12, { duration: 1.5 });
    } else {
      map.flyTo([16.0470, 108.2062], 6, { duration: 1.2 });
    }
  }, [selectedTrail, flyToPos, flyToZoom, isLiveTracking, map]);

  // Keep center and zoom persistent when changing map tile layers
  useEffect(() => {
    if (prevTileRef.current !== currentTileKey) {
      const center = map.getCenter();
      const zoom = map.getZoom();
      requestAnimationFrame(() => {
        map.setView(center, zoom, { animate: false });
        map.invalidateSize();
      });
      prevTileRef.current = currentTileKey;
    }
  }, [currentTileKey, map]);

  return null;
};

// Tactical Custom Leaflet Controls (Zoom In/Out + Compass Overview)
const CustomMapControls: React.FC<{ onResetView: () => void }> = ({ onResetView }) => {
  const map = useMap();

  return (
    <div
      style={{
        position: 'absolute',
        top: 26,
        left: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(20px)',
          borderRadius: 14,
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => map.zoomIn()}
          aria-label="Phóng to"
          title="Phóng to (+)"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-main)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            borderBottom: '1px solid var(--color-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-main)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => map.zoomOut()}
          aria-label="Thu nhỏ"
          title="Thu nhỏ (-)"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-main)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-main)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Reset to Vietnam View Button */}
      <button
        type="button"
        onClick={onResetView}
        aria-label="Toàn cảnh Việt Nam"
        title="Đặt lại góc nhìn toàn cảnh bản đồ Việt Nam"
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(20px)',
          borderRadius: 14,
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          color: 'var(--color-text-dim)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-glow)';
          e.currentTarget.style.color = 'var(--color-primary)';
          e.currentTarget.style.background = 'rgba(74, 222, 128, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.color = 'var(--color-text-dim)';
          e.currentTarget.style.background = 'var(--color-bg-glass)';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </button>
    </div>
  );
};

export const MapView: React.FC<MapViewProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  incidents = [],
  height = '100%',
  onShowToast,
  allTrails,
  onSelectRegion,
}) => {
  const [currentTileKey, setCurrentTileKey] = useState<keyof typeof TILE_PROVIDERS>('satellite');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [flyToPos, setFlyToPos] = useState<[number, number] | null>(null);
  const [flyToZoom, setFlyToZoom] = useState<number>(13);
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsAltitude, setGpsAltitude] = useState<number | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isTileDropdownOpen, setIsTileDropdownOpen] = useState(false);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard' | 'alert'>('all');
  const [showGpxTracks, setShowGpxTracks] = useState(true);
  const [gpsToast, setGpsToast] = useState<{
    lat: number;
    lng: number;
    nearby: Trail[];
    geocodedAddress?: string;
  } | null>(null);

  const centerLat = selectedTrail ? selectedTrail.startLat : 16.0470;
  const centerLng = selectedTrail ? selectedTrail.startLng : 108.2062;
  const zoomLevel = selectedTrail ? 12 : 6;

  // Extract all trails that have active safety alerts across the region or country
  const alertSourceTrails = allTrails && allTrails.length > 0 ? allTrails : trails;
  const alertTrails = useMemo(() => {
    return alertSourceTrails
      .map((trail) => ({ trail, incident: matchTrailIncident(trail, incidents) }))
      .filter((item): item is { trail: Trail; incident: any } => !!item.incident);
  }, [alertSourceTrails, incidents]);

  // Memoize filtered trails calculation for 60 FPS performance
  const filteredTrails = useMemo(() => {
    if (difficultyFilter === 'alert') {
      return alertTrails.map((a) => a.trail);
    }
    return trails.filter((trail) => {
      if (difficultyFilter === 'easy') return trail.difficultyLevel <= 2;
      if (difficultyFilter === 'medium') return trail.difficultyLevel === 3;
      if (difficultyFilter === 'hard') return trail.difficultyLevel >= 4;
      return true;
    });
  }, [trails, difficultyFilter, alertTrails]);

  // Compute difficulty distribution counts for telemetry filter bar
  const difficultyCounts = useMemo(() => {
    let easy = 0;
    let medium = 0;
    let hard = 0;
    for (const t of trails) {
      if (t.difficultyLevel <= 2) easy++;
      else if (t.difficultyLevel === 3) medium++;
      else hard++;
    }
    return { all: trails.length, easy, medium, hard };
  }, [trails]);

  const handleToggleAlertFilter = () => {
    if (difficultyFilter === 'alert') {
      setDifficultyFilter('all');
    } else {
      setDifficultyFilter('alert');
      if (alertTrails.length > 0) {
        const first = alertTrails[0].trail;
        if (onSelectRegion && first.region) {
          onSelectRegion('All');
        }
        setFlyToPos([first.startLat, first.startLng]);
        setFlyToZoom(11);
        if (onShowToast) {
          onShowToast(`Đang lọc ${alertTrails.length} vị trí có cảnh báo an toàn thực địa`, 'info');
        }
      } else {
        if (onShowToast) {
          onShowToast('Hiện không có cảnh báo an toàn nào trên các cung đường này.', 'info');
        }
      }
    }
  };

  const handleFlyToAlertTrail = (trail: Trail) => {
    if (onSelectRegion && trail.region) {
      onSelectRegion('All');
    }
    setFlyToPos([trail.startLat, trail.startLng]);
    setFlyToZoom(13);
    setIsAlertsDrawerOpen(false);
    if (onShowToast) {
      onShowToast(`Đang định vị đến cung cảnh báo: ${trail.name}`, 'info');
    }
  };

  const currentTile = TILE_PROVIDERS[currentTileKey];

  const handleResetView = () => {
    setFlyToPos([16.0470, 108.2062]);
    setFlyToZoom(6);
    if (onShowToast) {
      onShowToast('Đã đặt lại góc nhìn toàn cảnh bản đồ Việt Nam', 'info');
    }
  };

  const handleLocateMe = async () => {
    setIsLocating(true);
    
    const performSpatialSearch = async (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      setUserLocation(coords);
      setFlyToPos(coords);
      setFlyToZoom(13);
      setIsLocating(false);

      try {
        const [nearby, geoData] = await Promise.all([
          fetchNearbyTrails(lat, lng, 4),
          reverseGeocode(lat, lng),
        ]);
        setGpsToast({
          lat,
          lng,
          nearby: nearby || [],
          geocodedAddress: geoData?.formattedAddress || geoData?.displayName,
        });
        if (onShowToast) {
          onShowToast('Đã xác định vị trí GPS thực tế của bạn!', 'info');
        }
      } catch (err) {
        setGpsToast({ lat, lng, nearby: [] });
      }
    };

    if (!navigator.geolocation) {
      if (onShowToast) {
        onShowToast('Trình duyệt không hỗ trợ GPS Geolocation', 'error');
      }
      performSpatialSearch(22.3364, 103.8438);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        performSpatialSearch(position.coords.latitude, position.coords.longitude);
      },
      () => {
        if (onShowToast) {
          onShowToast('Không thể lấy vị trí GPS chính xác, hiển thị vị trí mặc định', 'info');
        }
        performSpatialSearch(22.3364, 103.8438);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleToggleLiveTracking = () => {
    if (isLiveTracking) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsLiveTracking(false);
      if (onShowToast) onShowToast('Đã dừng chế độ theo dõi GPS thực địa', 'info');
    } else {
      if (!navigator.geolocation) {
        if (onShowToast) onShowToast('Trình duyệt không hỗ trợ cảm biến định vị GPS', 'error');
        return;
      }
      setIsLiveTracking(true);
      if (onShowToast) onShowToast('Đang kích hoạt theo dõi GPS thực địa trực tiếp...', 'info');

      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy, altitude, speed } = position.coords;
            const coords: [number, number] = [latitude, longitude];
            setUserLocation(coords);
            setGpsAccuracy(accuracy);
            if (altitude !== null && altitude !== undefined) setGpsAltitude(Math.round(altitude));
            if (speed !== null && speed !== undefined) setGpsSpeed(Math.max(0, Math.round(speed * 3.6)));
            setFlyToPos(coords);
          },
          (err) => {
            console.warn('GPS Watch Error:', err);
            if (onShowToast) onShowToast('Mất tín hiệu vệ tinh GPS', 'error');
            setIsLiveTracking(false);
          },
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
        );
      } catch {
        setIsLiveTracking(false);
      }
    }
  };

  // Memoize active trails to render GPX track polylines for
  const activeGpxTrails = useMemo(() => {
    return selectedTrail
      ? [selectedTrail]
      : filteredTrails.filter((t) => t.gpxTrack && t.gpxTrack.length > 0);
  }, [selectedTrail, filteredTrails]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 24, overflow: 'hidden' }}>
      {/* Tactical Floating Command Dock (Top Right) */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(24px)',
          padding: '3px 5px',
          borderRadius: 18,
          border: '1px solid var(--color-border)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          maxWidth: 'calc(100% - 24px)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* GPX Track Toggle Button */}
        <button
          type="button"
          onClick={() => setShowGpxTracks(!showGpxTracks)}
          aria-label="Bật tắt đường GPX"
          title="Bật/tắt hiển thị tracklog GPX thực tế"
          style={{
            height: 30,
            background: showGpxTracks ? 'rgba(74, 222, 128, 0.16)' : 'transparent',
            color: showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-dim)',
            border: showGpxTracks ? '1px solid var(--color-border-glow)' : '1px solid transparent',
            borderRadius: 12,
            padding: '0 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Activity size={13} color={showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-dim)'} />
          <span>GPX</span>
        </button>

        {/* Live GPS Tracking Toggle Button */}
        <button
          type="button"
          onClick={handleToggleLiveTracking}
          aria-label="Theo dõi GPS thực địa"
          title="Theo dõi vị trí GPS di chuyển liên tục theo thời gian thực"
          style={{
            height: 30,
            background: isLiveTracking ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
            color: isLiveTracking ? 'var(--color-sky)' : 'var(--color-text-dim)',
            border: isLiveTracking ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
            borderRadius: 12,
            padding: '0 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: isLiveTracking ? '0 0 14px rgba(56, 189, 248, 0.35)' : 'none',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isLiveTracking ? 'var(--color-sky)' : 'var(--color-text-dim)',
              boxShadow: isLiveTracking ? '0 0 8px var(--color-sky)' : 'none',
              display: 'inline-block',
            }}
          />
          <span>{isLiveTracking ? 'Live: Bật' : 'Live GPS'}</span>
        </button>

        {/* Locate Me GPS Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          aria-label="Định vị GPS của tôi"
          title="Xác định tọa độ GPS và tìm các cung trekking gần nhất"
          style={{
            height: 30,
            background: isLocating ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: 'var(--color-text-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '0 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: isLocating ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          <span>{isLocating ? 'Định vị...' : 'Vị Trí'}</span>
        </button>

        {/* Active Alerts Tactical Drawer Toggle Button */}
        <button
          type="button"
          onClick={() => setIsAlertsDrawerOpen(!isAlertsDrawerOpen)}
          aria-label="Danh sách điểm cảnh báo an toàn"
          title="Xem danh sách tất cả các điểm phát cảnh báo an toàn trên bản đồ"
          style={{
            height: 30,
            background: isAlertsDrawerOpen
              ? 'rgba(239, 68, 68, 0.25)'
              : alertTrails.length > 0
              ? 'rgba(239, 68, 68, 0.14)'
              : 'rgba(255, 255, 255, 0.05)',
            color: alertTrails.length > 0 ? '#ef4444' : 'var(--color-text-dim)',
            border: isAlertsDrawerOpen
              ? '1px solid #ef4444'
              : alertTrails.length > 0
              ? '1px solid rgba(239, 68, 68, 0.5)'
              : '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '0 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={12} color={alertTrails.length > 0 ? '#ef4444' : 'currentColor'} />
          <span>Cảnh Báo</span>
          {alertTrails.length > 0 && (
            <span
              style={{
                fontSize: '0.64rem',
                fontWeight: 800,
                background: '#ef4444',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: 8,
              }}
            >
              {alertTrails.length}
            </span>
          )}
        </button>

        {/* Tile Layer Selector Dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsTileDropdownOpen(!isTileDropdownOpen)}
            aria-label="Chọn lớp bản đồ"
            style={{
              height: 30,
              background: isTileDropdownOpen ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              color: 'var(--color-text-main)',
              border: isTileDropdownOpen ? '1px solid var(--color-border-glow)' : '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '0 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Layers size={13} color="var(--color-primary)" />
            <span>Vệ Tinh</span>
            <ChevronDown size={11} />
          </button>

          {isTileDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--color-bg-card)',
                backdropFilter: 'blur(24px)',
                border: '1px solid var(--color-border-glow)',
                borderRadius: 14,
                padding: 5,
                boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75)',
                minWidth: 190,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                zIndex: 1001,
              }}
            >
              {(Object.keys(TILE_PROVIDERS) as Array<keyof typeof TILE_PROVIDERS>).map((key) => {
                const isSelected = key === currentTileKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCurrentTileKey(key);
                      setIsTileDropdownOpen(false);
                    }}
                    style={{
                      background: isSelected ? 'rgba(74, 222, 128, 0.16)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '7px 10px',
                      fontSize: '0.76rem',
                      fontWeight: isSelected ? 800 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{TILE_PROVIDERS[key].name}</span>
                    {isSelected && <Check size={13} color="var(--color-primary)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tactical Incidents Floating Panel / Drawer */}
      <TacticalIncidentsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        alertTrails={alertTrails}
        onFlyTo={handleFlyToAlertTrail}
        onSelectTrail={onSelectTrail}
        onFilterAlerts={handleToggleAlertFilter}
        isFilterActive={difficultyFilter === 'alert'}
      />

      {/* Floating Difficulty Filter Toolbar (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(20px)',
          padding: '3px 5px',
          borderRadius: 20,
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          maxWidth: 'calc(100% - 24px)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 7px',
            borderRight: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)',
            fontSize: '0.68rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Filter size={11} color="var(--color-primary)" />
          <span>Cấp độ</span>
        </div>

        <button
          type="button"
          onClick={() => setDifficultyFilter('all')}
          style={{
            background: difficultyFilter === 'all' ? 'rgba(74, 222, 128, 0.16)' : 'transparent',
            color: difficultyFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-dim)',
            border: difficultyFilter === 'all' ? '1px solid var(--color-border-glow)' : '1px solid transparent',
            borderRadius: 12,
            padding: '4px 7px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span>Tất cả</span>
          <span
            style={{
              fontSize: '0.66rem',
              opacity: 0.85,
              background: difficultyFilter === 'all' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: 8,
            }}
          >
            {difficultyCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDifficultyFilter('easy')}
          style={{
            background: difficultyFilter === 'easy' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
            color: difficultyFilter === 'easy' ? '#10b981' : 'var(--color-text-dim)',
            border: difficultyFilter === 'easy' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
            borderRadius: 12,
            padding: '4px 7px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />
          <span>Dễ (1-2)</span>
          <span
            style={{
              fontSize: '0.66rem',
              opacity: 0.85,
              background: difficultyFilter === 'easy' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: 8,
            }}
          >
            {difficultyCounts.easy}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDifficultyFilter('medium')}
          style={{
            background: difficultyFilter === 'medium' ? 'rgba(250, 204, 21, 0.18)' : 'transparent',
            color: difficultyFilter === 'medium' ? 'var(--color-sun)' : 'var(--color-text-dim)',
            border: difficultyFilter === 'medium' ? '1px solid rgba(250, 204, 21, 0.5)' : '1px solid transparent',
            borderRadius: 12,
            padding: '4px 7px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-sun)', boxShadow: '0 0 6px var(--color-sun)', flexShrink: 0 }} />
          <span>Vừa (3)</span>
          <span
            style={{
              fontSize: '0.66rem',
              opacity: 0.85,
              background: difficultyFilter === 'medium' ? 'rgba(250, 204, 21, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: 8,
            }}
          >
            {difficultyCounts.medium}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDifficultyFilter('hard')}
          style={{
            background: difficultyFilter === 'hard' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
            color: difficultyFilter === 'hard' ? 'var(--color-error)' : 'var(--color-text-dim)',
            border: difficultyFilter === 'hard' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
            borderRadius: 12,
            padding: '4px 7px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)', boxShadow: '0 0 6px var(--color-error)', flexShrink: 0 }} />
          <span>Khó (4-5)</span>
          <span
            style={{
              fontSize: '0.66rem',
              opacity: 0.85,
              background: difficultyFilter === 'hard' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: 8,
            }}
          >
            {difficultyCounts.hard}
          </span>
        </button>

        {/* Active Safety Warnings Filter Button */}
        <button
          type="button"
          onClick={handleToggleAlertFilter}
          aria-label="Lọc các địa điểm phát cảnh báo"
          title="Chỉ hiển thị các cung đường đang có cảnh báo sự cố an toàn"
          style={{
            background: difficultyFilter === 'alert'
              ? 'rgba(239, 68, 68, 0.28)'
              : alertTrails.length > 0
              ? 'rgba(239, 68, 68, 0.12)'
              : 'transparent',
            color: difficultyFilter === 'alert' || alertTrails.length > 0 ? '#ef4444' : 'var(--color-text-dim)',
            border: difficultyFilter === 'alert'
              ? '1px solid #ef4444'
              : alertTrails.length > 0
              ? '1px solid rgba(239, 68, 68, 0.45)'
              : '1px solid transparent',
            borderRadius: 12,
            padding: '4px 7px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 6px #ef4444',
              flexShrink: 0,
            }}
          />
          <span>Cảnh Báo</span>
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              background: difficultyFilter === 'alert' ? '#ef4444' : 'rgba(239, 68, 68, 0.22)',
              color: difficultyFilter === 'alert' ? '#ffffff' : '#ef4444',
              padding: '1px 5px',
              borderRadius: 8,
            }}
          >
            {alertTrails.length}
          </span>
        </button>
      </div>

      {/* Map Element Container */}
      <div style={{
        height: '100%',
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={zoomLevel}
          minZoom={5.5}
          maxZoom={18}
          maxBounds={[
            [6.8, 100.8],
            [24.5, 115.2],
          ]}
          maxBoundsViscosity={0.9}
          zoomControl={false}
          scrollWheelZoom={true}
          preferCanvas={true}
          style={{ width: '100%', height: '100%', borderRadius: 24 }}
        >
          <CustomMapControls onResetView={handleResetView} />
          <MapController selectedTrail={selectedTrail} flyToPos={flyToPos} flyToZoom={flyToZoom} currentTileKey={currentTileKey} isLiveTracking={isLiveTracking} />

          <TileLayer
            key={currentTileKey}
            attribution={currentTile.attribution}
            url={currentTile.url}
          />

          {/* User GPS Location Accuracy Radius Circle */}
          {userLocation && gpsAccuracy && gpsAccuracy > 0 && (
            <Circle
              center={userLocation}
              radius={gpsAccuracy}
              pathOptions={{
                color: '#38bdf8',
                fillColor: '#38bdf8',
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: '4, 4',
              }}
            />
          )}

          {/* User GPS Location Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={createUserGpsIcon()}>
              <Popup>
                <div style={{ padding: 4, minWidth: 160 }}>
                  <div style={{ color: 'var(--color-sky)', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
                    Vị Trí Thực Tế (GPS)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
                    Tọa độ: {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                  </div>
                  {gpsAccuracy && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Độ chính xác: ±{Math.round(gpsAccuracy)}m
                    </div>
                  )}
                  {(gpsAltitude !== null || gpsSpeed !== null) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.72rem', color: 'var(--color-primary)' }}>
                      {gpsAltitude !== null && <span>Cao độ: {gpsAltitude}m</span>}
                      {gpsSpeed !== null && <span>Tốc độ: {gpsSpeed} km/h</span>}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Ultra-Sleek Strava/AllTrails Style Dual-Layer GPX Polylines (Rendered ONLY for Selected Trail) */}
          {showGpxTracks &&
            activeGpxTrails
              .filter((trail) => selectedTrail && selectedTrail.id === trail.id)
              .map((trail) => {
                const track = trail.gpxTrack;
                if (!track || track.length === 0) return null;

                const startPos = track[0];
                const endPos = track[track.length - 1];

                return (
                  <React.Fragment key={`gpx-group-${trail.id}`}>
                    {/* Layer 1: Dark Outline Halo for High Contrast against Satellite Terrain */}
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: '#020617',
                        weight: 7,
                        opacity: 0.75,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                    {/* Layer 2: Sleek Core Track Line (Clickable to open TrailDetailView) */}
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: '#10b981',
                        weight: 4,
                        opacity: 1.0,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{
                        click: () => onSelectTrail?.(trail),
                      }}
                    />
                    {/* Layer 3: Accent Vector Dash for Selected Track */}
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: '#ffffff',
                        weight: 2,
                        opacity: 0.9,
                        dashArray: '6, 10',
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{
                        click: () => onSelectTrail?.(trail),
                      }}
                    />
                    {/* Start Flag Marker at gpxTrack[0] */}
                    {startPos && (
                      <Marker
                        position={startPos}
                        icon={createStartEndIcon('start', 'Xuất phát')}
                        eventHandlers={{
                          click: () => onSelectTrail?.(trail),
                        }}
                      />
                    )}
                    {/* Summit Finish Flag Marker at gpxTrack[last] */}
                    {endPos && (
                      <Marker
                        position={endPos}
                        icon={createStartEndIcon('finish', `${trail.maxAltitudeM}m`)}
                        eventHandlers={{
                          click: () => onSelectTrail?.(trail),
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

          {/* SVG Mountain Teardrop Markers with Integrated Warning Badges & Dynamic Flip Tooltips */}
          {filteredTrails.map((trail) => {
            const tid = trail.id || (trail as any)._id;
            const matchingIncident = matchTrailIncident(trail, incidents);

            return (
              <Marker
                key={tid}
                position={[trail.startLat, trail.startLng]}
                icon={createTrailSvgIcon(trail, matchingIncident)}
                eventHandlers={{
                  click: () => onSelectTrail?.(trail),
                }}
              >
                <Tooltip
                  direction="auto"
                  offset={[0, -25]}
                  opacity={1}
                  interactive={true}
                  className="tactical-leaflet-tooltip"
                >
                  <TacticalTrailTooltip
                    trail={trail}
                    incident={matchingIncident}
                    onSelect={() => onSelectTrail?.(trail)}
                  />
                </Tooltip>
                <Popup className="custom-leaflet-popup">
                  <TrailPopupContent
                    trail={trail}
                    incident={matchingIncident}
                    onSelect={() => onSelectTrail?.(trail)}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Organic Nature GPS Toast Notification Card Overlay */}
      {gpsToast && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          zIndex: 1050,
          width: 350,
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 20,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-sky)', fontWeight: 800, fontSize: '0.88rem' }}>
              <span>Định Vị GPS [ {gpsToast.lat.toFixed(4)}, {gpsToast.lng.toFixed(4)} ]</span>
            </div>
            <button
              onClick={() => setGpsToast(null)}
              style={{
                background: 'var(--color-border)',
                border: 'none',
                color: 'var(--color-text-muted)',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Đóng
            </button>
          </div>

          {gpsToast.geocodedAddress && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 8, background: 'rgba(74, 222, 128, 0.12)', padding: '4px 8px', borderRadius: 6 }}>
              {gpsToast.geocodedAddress}
            </div>
          )}

          {gpsToast.nearby.length > 0 ? (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                  <span>Cung đường gần bạn nhất:</span>
                </span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{gpsToast.nearby.length} cung đường</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {gpsToast.nearby.map((t) => {
                  const color = getDifficultyColor(t.difficultyLevel);
                  const diffInfo = getDifficultyInfo(t.difficultyLevel);
                  const dist = (t as any).distanceFromUserKm;
                  const roadDist = (t as any).roadDistanceKm || (t as any).estimatedRoadDistanceKm || (dist ? Math.round(dist * 1.8) : null);
                  const duration = (t as any).travelDurationFormatted;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        onSelectTrail?.(t);
                        setFlyToPos([t.startLat, t.startLng]);
                      }}
                      style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-glow)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden', marginRight: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', paddingLeft: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                            {t.province}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                            {t.maxAltitudeM}m
                          </span>
                          <span>•</span>
                          <span>Cấp {diffInfo.label}</span>
                        </div>
                      </div>
                      
                      {roadDist && (
                        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span
                            title={dist ? `Khoảng cách đường bộ di chuyển thực tế: ~${roadDist} km (Đường chim bay: ~${dist} km)` : undefined}
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--color-sky)',
                              fontWeight: 800,
                              background: 'rgba(56, 189, 248, 0.16)',
                              padding: '3px 8px',
                              borderRadius: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11 2 11.4V16c0 .6.4 1 1 1h2" />
                              <circle cx="7" cy="17" r="2" />
                              <path d="M9 17h6" />
                              <circle cx="17" cy="17" r="2" />
                            </svg>
                            ~{roadDist} km
                          </span>
                          {duration && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
                              ~{duration} đi xe
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
              Đang xác định các cung đường trekking gần nhất...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
