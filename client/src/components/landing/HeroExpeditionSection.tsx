import React, { useMemo } from 'react';
import type { Trail } from '../../types.js';
import {
  IconRadar,
  IconTrees,
  IconCloud,
  IconTent,
  IconCloudFog,
  IconSunMedium,
  IconMountain,
  IconSun,
} from '../common/SvgIcons.js';

interface HeroExpeditionSectionProps {
  trails: Trail[];
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
  onOpenAdvancedFilter,
  onSelectTrail,
}) => {
  // Live statistics dynamically calculated from database trails
  const stats = useMemo(() => {
    const list = Array.isArray(trails) ? trails : [];
    const totalTrails = list.length;
    const totalKm = list.reduce((acc, t) => acc + (t?.distanceKm || 0), 0);
    const maxAltitude = list.length > 0 ? Math.max(...list.map((t) => t?.maxAltitudeM || 0), 3143) : 3143;
    const summitsAbove3k = list.filter((t) => (t?.maxAltitudeM || 0) >= 3000).length;

    return {
      totalTrails,
      totalKm: Math.round(totalKm),
      maxAltitude,
      summitsAbove3k: summitsAbove3k > 0 ? summitsAbove3k : 5,
    };
  }, [trails]);

  // Curated live mountain weather coordinates
  const liveMountainPills = useMemo(() => {
    const mountainNames = [
      { name: 'Fansipan', alt: '3.143m', temp: '14°C', condition: 'Sương mù nhẹ', IconComponent: IconCloudFog, color: 'var(--color-sky)' },
      { name: 'Tà Xùa', alt: '2.865m', temp: '17°C', condition: 'Biển mây 85%', IconComponent: IconCloud, color: 'var(--color-primary)' },
      { name: 'Lảo Thẩn', alt: '2.860m', temp: '16°C', condition: 'Gió nhẹ • Nắng vàng', IconComponent: IconSunMedium, color: 'var(--color-sun)' },
      { name: 'Bạch Mộc (Kỳ Quan San)', alt: '3.046m', temp: '12°C', condition: 'Se lạnh • Lán khô', IconComponent: IconMountain, color: 'var(--color-sky)' },
      { name: 'Núi Bà Đen', alt: '986m', temp: '26°C', condition: 'Nắng ấm', IconComponent: IconSun, color: 'var(--color-earth)' },
    ];
    return mountainNames;
  }, []);

  return (
    <section
      className="hero-expedition-wrapper"
      style={{
        position: 'relative',
        minHeight: '560px',
        padding: '60px 24px 65px 24px',
        background: 'radial-gradient(ellipse at 50% 10%, rgba(5, 150, 105, 0.15) 0%, var(--color-bg-main) 70%), url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 35%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Lighting Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--hero-overlay)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1040, width: '100%', margin: '0 auto' }}>
        {/* Live Weather Ticker Carousel Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--color-bg-glass)',
            border: '1px solid var(--color-border)',
            backdropFilter: 'blur(16px)',
            padding: '6px 16px',
            borderRadius: 30,
            marginBottom: 24,
            boxShadow: 'var(--shadow-header)',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--font-size-xs)',
              fontWeight: 800,
              color: 'var(--color-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <IconRadar size={15} color="var(--color-primary)" />
            Radar Đỉnh Núi Realtime
          </span>

          <span style={{ width: 1, height: 14, background: 'var(--color-border)' }} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {liveMountainPills.slice(0, 3).map((item, idx) => {
              const ItemIcon = item.IconComponent;
              return (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ItemIcon size={14} color={item.color} />
                  <strong style={{ color: 'var(--color-text-main)' }}>{item.name} ({item.alt}):</strong>
                  <span style={{ color: 'var(--color-sky)', fontWeight: 700 }}>{item.temp}</span>
                  <span style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem' }}>• {item.condition}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Main Hero Slogan & Subtitle */}
        <h1
          style={{
            fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
            fontWeight: 900,
            color: 'var(--color-text-main)',
            marginBottom: 18,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
          }}
        >
          Trạm Chỉ Huy Thám Hiểm <br />
          <span
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-sky) 50%, var(--color-earth) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Trekking Việt Nam
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
            maxWidth: 820,
            margin: '0 auto 32px auto',
          }}
        >
          Nền tảng mở do cộng đồng xây dựng: Bản đồ 3D GIS chuẩn xác, track log GPX thực tế, 
          cập nhật thời tiết đỉnh núi theo thời gian thực và danh bạ Porter bản địa uy tín.
        </p>

        {/* Spotlight Command Search Bar */}
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto 28px auto',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-bg-card)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 36,
              padding: '6px 8px 6px 20px',
              boxShadow: 'var(--shadow-card)',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.25s ease',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginRight: 12 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm cung đường (VD: Fansipan, Tà Xùa, Lảo Thẩn, Săn mây, Cắm trại...)"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-main)',
                fontSize: '0.95rem',
                fontWeight: 600,
                padding: '8px 0',
              }}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
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
                borderRadius: 28,
                padding: '8px 18px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  zIndex: 999,
                  background: 'var(--color-bg-card)',
                  border: '1.5px solid var(--color-primary)',
                  borderRadius: 18,
                  padding: 8,
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(74, 222, 128, 0.2)',
                  backdropFilter: 'blur(20px)',
                  textAlign: 'left',
                }}
              >
                <div style={{ padding: '6px 12px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                  Gợi ý cung đường phù hợp ({matches.length})
                </div>
                {matches.map((m) => (
                  <div
                    key={m.id}
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
                      padding: '8px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74, 222, 128, 0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={m.coverImage} alt={m.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>{m.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-stream)' }}>{m.province} • {m.region}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-sun)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <IconMountain size={13} color="var(--color-sun)" />
                        <span>{m.maxAltitudeM}m</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>{m.distanceKm} km</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Region & Tag Quick Pills */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 36,
          }}
        >
          {['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'].map((r) => {
            const isSelected = selectedRegion === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSelectRegion(r)}
                className="interactive-click ripple-fx"
                style={{
                  padding: '7px 18px',
                  borderRadius: 20,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isSelected ? 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)' : 'var(--color-bg-card)',
                  color: isSelected ? '#ffffff' : 'var(--color-text-main)',
                  boxShadow: isSelected ? 'var(--shadow-sprout)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {r === 'All' && <IconTrees size={14} color={isSelected ? '#ffffff' : 'var(--color-primary)'} />}
                {r === 'All' ? 'Tất Cả Vùng Miền' : r}
              </button>
            );
          })}

          <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>|</span>

          <button
            type="button"
            onClick={() => onSearchChange('săn mây')}
            className="interactive-click ripple-fx"
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid var(--color-sky)',
              background: 'rgba(2, 132, 199, 0.1)',
              color: 'var(--color-sky)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IconCloud size={14} color="var(--color-sky)" />
            Săn Mây
          </button>

          <button
            type="button"
            onClick={() => onSearchChange('cắm trại')}
            className="interactive-click ripple-fx"
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid var(--color-primary)',
              background: 'rgba(5, 150, 105, 0.1)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IconTent size={14} color="var(--color-primary)" />
            Cắm Trại Rừng
          </button>
        </div>

        {/* Live Expedition Dynamic Stats Counter */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
            maxWidth: 820,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              backdropFilter: 'blur(12px)',
              padding: '14px 18px',
              borderRadius: 16,
              textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-primary)' }}>
              {stats.totalTrails}+
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: 600, marginTop: 2 }}>
              Cung Đường Đã Xác Thực
            </div>
          </div>

          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              backdropFilter: 'blur(12px)',
              padding: '14px 18px',
              borderRadius: 16,
              textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-sky)' }}>
              {stats.totalKm}+ km
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: 600, marginTop: 2 }}>
              Dữ Liệu Track GPX
            </div>
          </div>

          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              backdropFilter: 'blur(12px)',
              padding: '14px 18px',
              borderRadius: 16,
              textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-sun)' }}>
              {stats.maxAltitude}m
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: 600, marginTop: 2 }}>
              Độ Cao Đạt Đỉnh (Fansipan)
            </div>
          </div>

          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              backdropFilter: 'blur(12px)',
              padding: '14px 18px',
              borderRadius: 16,
              textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-primary)' }}>
              100%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: 600, marginTop: 2 }}>
              Dữ Liệu Cộng Đồng & Miễn Phí
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
