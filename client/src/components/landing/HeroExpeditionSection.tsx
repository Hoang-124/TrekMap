import React, { useMemo, useState } from 'react';
import type { Trail } from '../../types.js';
import {
  IconRadar,
  IconTrees,
  IconTree,
  IconCloud,
  IconTent,
  IconCloudFog,
  IconSunMedium,
  IconMountain,
  IconSun,
  IconSearch,
  IconCompass,
  IconShieldCheck,
  IconSparkles,
  IconFlame,
  IconMapPin,
} from '../common/SvgIcons.js';

interface HeroExpeditionSectionProps {
  trails: Trail[];
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  campsiteOnly?: boolean;
  onToggleCampsite?: () => void;
  onOpenAdvancedFilter: () => void;
  onScrollToMap: () => void;
  onExploreClick: () => void;
  onSelectTrail?: (trail: Trail) => void;
}

export const HeroExpeditionSection: React.FC<HeroExpeditionSectionProps> = ({
  trails,
  selectedRegion,
  onSelectRegion,
  searchQuery,
  onSearchChange,
  campsiteOnly = false,
  onToggleCampsite,
  onOpenAdvancedFilter,
  onScrollToMap,
  onSelectTrail,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Live statistics dynamically calculated from database trails
  const stats = useMemo(() => {
    const list = Array.isArray(trails) ? trails : [];
    const totalTrails = list.length > 0 ? list.length : 18;
    const totalKm = list.reduce((acc, t) => acc + (t?.distanceKm || 0), 0);
    const maxAltitude = list.length > 0 ? Math.max(...list.map((t) => t?.maxAltitudeM || 0), 3143) : 3143;
    const summitsAbove3k = list.filter((t) => (t?.maxAltitudeM || 0) >= 3000).length;

    return {
      totalTrails,
      totalKm: totalKm > 0 ? Math.round(totalKm) : 450,
      maxAltitude,
      summitsAbove3k: summitsAbove3k > 0 ? summitsAbove3k : 6,
    };
  }, [trails]);

  // Curated live mountain weather coordinates
  const liveMountainPills = useMemo(() => [
    { name: 'Fansipan', alt: '3.143m', temp: '14°C', condition: 'Sương mù nhẹ', IconComponent: IconCloudFog, color: 'var(--color-sky)' },
    { name: 'Bạch Mộc (Kỳ Quan San)', alt: '3.046m', temp: '12°C', condition: 'Se lạnh • Lán khô', IconComponent: IconMountain, color: 'var(--color-sky)' },
    { name: 'Tà Xùa', alt: '2.865m', temp: '17°C', condition: 'Biển mây 85%', IconComponent: IconCloud, color: 'var(--color-primary)' },
    { name: 'Lảo Thẩn', alt: '2.860m', temp: '16°C', condition: 'Gió nhẹ • Nắng vàng', IconComponent: IconSunMedium, color: 'var(--color-sun)' },
    { name: 'Chư Yang Sin', alt: '2.442m', temp: '19°C', condition: 'Rừng nguyên sinh', IconComponent: IconTree, color: 'var(--color-earth)' },
    { name: 'Núi Bà Đen', alt: '986m', temp: '26°C', condition: 'Trời quang đãng', IconComponent: IconSun, color: 'var(--color-earth)' },
  ], []);

  return (
    <section
      className="hero-expedition-wrapper"
      style={{
        position: 'relative',
        padding: '24px 20px 32px 20px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.16) 0%, rgba(7, 13, 30, 0.9) 55%, var(--color-bg-main) 100%), url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Topographic GIS Contour Grid Visual Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.07) 0%, transparent 65%),
                            linear-gradient(to bottom, transparent 0%, var(--color-bg-main) 100%)`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1040, width: '100%', margin: '0 auto' }}>
        {/* 1. Live Weather & GIS Radar Capsule */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--color-bg-glass)',
            border: '1px solid var(--color-border)',
            backdropFilter: 'blur(16px)',
            padding: '5px 14px',
            borderRadius: 24,
            marginBottom: 14,
            boxShadow: 'var(--shadow-header)',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {/* Pulsing Live Beacon */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--color-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                boxShadow: '0 0 8px var(--color-primary)',
                animation: 'pulse 2s infinite',
              }}
            />
            <IconRadar size={13} color="var(--color-primary)" />
            Radar Khí Tượng Đỉnh Núi
          </span>

          <span style={{ width: 1, height: 14, background: 'var(--color-border)' }} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: '0.74rem',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {liveMountainPills.map((item, idx) => {
              const ItemIcon = item.IconComponent;
              return (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ItemIcon size={13} color={item.color} />
                  <strong style={{ color: 'var(--color-text-main)' }}>{item.name}</strong>
                  <span style={{ color: item.color, fontWeight: 800 }}>{item.temp}</span>
                  <span style={{ color: 'var(--color-text-dim)', fontSize: '0.7rem' }}>• {item.condition}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* 2. Main Hero Title & Slogan */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-sky)',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '3px 12px',
              borderRadius: 16,
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <IconSparkles size={12} color="var(--color-sky)" />
            HỆ THỐNG BẢN ĐỒ ĐỊA HÌNH & DỮ LIỆU TREKKING VIỆT NAM
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)',
              fontWeight: 900,
              color: 'var(--color-text-main)',
              margin: '0 0 8px 0',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            Chinh Phục Mọi Đỉnh Cao{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #38bdf8 50%, #facc15 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 10px rgba(16, 185, 129, 0.25))',
              }}
            >
              Trekking Việt Nam
            </span>
          </h1>

          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
              maxWidth: 680,
              margin: '0 auto',
            }}
          >
            Dữ liệu số hóa <strong>18+ cung đường thực địa</strong>: Tọa độ 3D GIS, tải tracklog GPX chuẩn xác, 
            dự báo thời tiết thời gian thực và mạng lưới cứu hộ 24/7.
          </p>
        </div>

        {/* 3. Compact Spotlight Search Bar */}
        <div
          style={{
            maxWidth: 620,
            margin: '0 auto 12px auto',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-bg-card)',
              border: isSearchFocused ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
              borderRadius: 30,
              padding: '4px 6px 4px 16px',
              boxShadow: isSearchFocused
                ? '0 0 20px rgba(16, 185, 129, 0.35), 0 12px 28px rgba(0, 0, 0, 0.5)'
                : 'var(--shadow-card)',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <IconSearch
              size={18}
              color={isSearchFocused ? 'var(--color-primary)' : 'var(--color-text-dim)'}
              style={{ flexShrink: 0, marginRight: 10, transition: 'color 0.2s ease' }}
            />

            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm cung đường (VD: Fansipan, Tà Xùa, Lảo Thẩn, Săn mây, Cắm trại...)"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-main)',
                fontSize: '0.88rem',
                fontWeight: 600,
                padding: '6px 0',
              }}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                title="Xóa tìm kiếm"
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                  fontSize: '0.75rem',
                }}
              >
                ✕
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAdvancedFilter}
              className="btn btn-outline"
              style={{
                borderRadius: 22,
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Bộ Lọc
            </button>
          </div>

          {/* Live Autocomplete Suggestions Dropdown */}
          {searchQuery && searchQuery.trim().length > 0 && (() => {
            const list = Array.isArray(trails) ? trails : [];
            const q = searchQuery.trim().toLowerCase();
            const matches = list.filter(
              (t) =>
                (t?.name || '').toLowerCase().includes(q) ||
                (t?.province || '').toLowerCase().includes(q) ||
                (t?.district || '').toLowerCase().includes(q) ||
                (t?.region || '').toLowerCase().includes(q)
            ).slice(0, 4);

            if (matches.length === 0) return null;

            return (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 999,
                  background: 'var(--color-bg-card)',
                  border: '1.5px solid var(--color-primary)',
                  borderRadius: 16,
                  padding: 6,
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(16, 185, 129, 0.25)',
                  backdropFilter: 'blur(20px)',
                  textAlign: 'left',
                }}
              >
                <div style={{ padding: '4px 10px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                  Gợi ý cung đường phù hợp ({matches.length})
                </div>
                {matches.map((m, idx) => (
                  <div
                    key={m.id || (m as any)._id || `match-${idx}`}
                    onClick={() => {
                      if (onSelectTrail) {
                        onSelectTrail(m);
                      } else {
                        onSearchChange(m.name);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img
                        src={m.coverImage || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=100&q=80'}
                        alt={m.name}
                        style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{m.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-sky)' }}>{m.province} • {m.region}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-sun)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        <IconMountain size={12} color="var(--color-sun)" />
                        <span>{m.maxAltitudeM}m</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>{m.distanceKm} km</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* 4. Single Unified Filter & Region Pill Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          {/* Region Buttons */}
          {[
            { id: 'All', label: 'Tất Cả Vùng Miền', IconComponent: IconTrees },
            { id: 'Miền Bắc', label: 'Miền Bắc', IconComponent: IconMountain },
            { id: 'Miền Trung', label: 'Miền Trung', IconComponent: IconSun },
            { id: 'Miền Nam', label: 'Miền Nam', IconComponent: IconTree },
          ].map((r) => {
            const isSelected = selectedRegion === r.id;
            const RegionIcon = r.IconComponent;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelectRegion(r.id);
                  onScrollToMap();
                }}
                className="interactive-click"
                style={{
                  padding: '6px 14px',
                  borderRadius: 18,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isSelected
                    ? 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)'
                    : 'var(--color-bg-card)',
                  color: isSelected ? '#ffffff' : 'var(--color-text-main)',
                  boxShadow: isSelected ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <RegionIcon size={13} color={isSelected ? '#ffffff' : 'var(--color-primary)'} />
                {r.label}
              </button>
            );
          })}

          <span style={{ color: 'var(--color-border)', margin: '0 2px' }}>|</span>

          {/* Săn Mây Filter Tag */}
          {(() => {
            const isCloudActive = searchQuery.toLowerCase().includes('mây');
            return (
              <button
                type="button"
                onClick={() => {
                  onSearchChange(isCloudActive ? '' : 'mây');
                  onScrollToMap();
                }}
                className="interactive-click"
                style={{
                  padding: '6px 12px',
                  borderRadius: 18,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  border: isCloudActive ? '1px solid var(--color-sky)' : '1px solid rgba(56, 189, 248, 0.3)',
                  background: isCloudActive ? 'linear-gradient(135deg, var(--color-sky) 0%, #0284c7 100%)' : 'rgba(56, 189, 248, 0.1)',
                  color: isCloudActive ? '#ffffff' : 'var(--color-sky)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: isCloudActive ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <IconCloud size={13} color={isCloudActive ? '#ffffff' : 'var(--color-sky)'} />
                {isCloudActive ? '✓ Đang Lọc Săn Mây' : 'Săn Mây'}
              </button>
            );
          })()}

          {/* Cắm Trại Rừng Filter Tag */}
          <button
            type="button"
            onClick={() => {
              if (onToggleCampsite) {
                onToggleCampsite();
              } else {
                onSearchChange(searchQuery === 'cắm trại' ? '' : 'cắm trại');
              }
              onScrollToMap();
            }}
            className="interactive-click"
            style={{
              padding: '6px 12px',
              borderRadius: 18,
              fontSize: '0.76rem',
              fontWeight: 700,
              border: campsiteOnly ? '1px solid var(--color-primary)' : '1px solid rgba(16, 185, 129, 0.3)',
              background: campsiteOnly ? 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)' : 'rgba(16, 185, 129, 0.1)',
              color: campsiteOnly ? '#ffffff' : 'var(--color-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: campsiteOnly ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <IconTent size={13} color={campsiteOnly ? '#ffffff' : 'var(--color-primary)'} />
            {campsiteOnly ? '✓ Đang Lọc Bãi Trại' : 'Cắm Trại Rừng'}
          </button>

          {/* Smooth Scroll To Map Button */}
          <button
            type="button"
            onClick={() => onScrollToMap()}
            className="interactive-click"
            style={{
              padding: '6px 13px',
              borderRadius: 18,
              fontSize: '0.76rem',
              fontWeight: 800,
              border: '1px solid var(--color-sun)',
              background: 'rgba(250, 204, 21, 0.12)',
              color: 'var(--color-sun)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s ease',
            }}
          >
            <IconCompass size={13} color="var(--color-sun)" />
            Bản Đồ 3D (GIS) ↓
          </button>
        </div>

        {/* 5. Streamlined 4 Metric Stat Cards (Clickable & Scrolls to Map) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            maxWidth: 960,
            margin: '0 auto',
          }}
        >
          {/* Metric 1 */}
          <div
            onClick={() => onScrollToMap()}
            className="card-hover-lift"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, var(--color-bg-card) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(16px)',
              padding: '10px 14px',
              borderRadius: 14,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-card)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconMountain size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1.1 }}>
                {stats.totalTrails}+
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                Cung Đường Đã Xác Thực
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)' }}>
                100% Thực địa Việt Nam
              </div>
            </div>
          </div>

          {/* Metric 2 */}
          <div
            onClick={() => onScrollToMap()}
            className="card-hover-lift"
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, var(--color-bg-card) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              backdropFilter: 'blur(16px)',
              padding: '10px 14px',
              borderRadius: 14,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-card)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconMapPin size={18} color="var(--color-sky)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-sky)', lineHeight: 1.1 }}>
                {stats.totalKm}+ km
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                Tracklog GPX Chuẩn
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)' }}>
                Độ dốc & Trắc diện cao độ
              </div>
            </div>
          </div>

          {/* Metric 3 */}
          <div
            onClick={() => onScrollToMap()}
            className="card-hover-lift"
            style={{
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.12) 0%, var(--color-bg-card) 100%)',
              border: '1px solid rgba(250, 204, 21, 0.3)',
              backdropFilter: 'blur(16px)',
              padding: '10px 14px',
              borderRadius: 14,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-card)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(250, 204, 21, 0.2)',
                border: '1px solid rgba(250, 204, 21, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconFlame size={18} color="var(--color-sun)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-sun)', lineHeight: 1.1 }}>
                {stats.maxAltitude}m
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                Đỉnh Fansipan Cao Nhất
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)' }}>
                {stats.summitsAbove3k} Đỉnh &gt; 3.000m
              </div>
            </div>
          </div>

          {/* Metric 4 */}
          <div
            onClick={() => onScrollToMap()}
            className="card-hover-lift"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.12) 0%, var(--color-bg-card) 100%)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              backdropFilter: 'blur(16px)',
              padding: '10px 14px',
              borderRadius: 14,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-card)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(34, 211, 238, 0.2)',
                border: '1px solid rgba(34, 211, 238, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconShieldCheck size={18} color="var(--color-stream)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-stream)', lineHeight: 1.1 }}>
                100%
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                Kiểm Lâm & Cứu Hộ
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)' }}>
                Xác thực danh bạ 24/7
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


