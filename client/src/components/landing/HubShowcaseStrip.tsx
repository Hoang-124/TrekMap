import React, { useMemo } from 'react';
import { mockTrails } from '../../data/seedData.js';
import {
  VIETNAM_SUMMIT_CHALLENGES,
  VIETNAM_RANGER_STATIONS,
} from '../../data/vietnamDirectory.js';
import {
  IconMountain,
  IconCalendar,
  IconCompass,
  IconSatellite,
  IconHiking,
  IconShieldAlert,
  IconBackpack,
  IconRadar,
  IconRadio,
  IconSearch,
  IconArrowRight,
} from '../common/SvgIcons.js';

export type ExpeditionHubKey =
  | 'passport'
  | 'almanac'
  | 'planner'
  | 'toolkit'
  | 'directory'
  | 'training'
  | 'gear'
  | 'radar';

export interface HubShowcaseStripProps {
  trailsCount?: number;
  onNavigateHub: (hub: ExpeditionHubKey) => void;
  onOpenLiveTracker?: () => void;
  onOpenCommandPalette?: () => void;
}

interface PrimaryHubCard {
  id: ExpeditionHubKey;
  index: string;
  title: string;
  subtitle: string;
  metric: string;
  accent: string;
  icon: React.ReactNode;
}

interface QuickLaunchHub {
  id: ExpeditionHubKey;
  title: string;
  caption: string;
  accent: string;
  icon: React.ReactNode;
}

export const HubShowcaseStrip: React.FC<HubShowcaseStripProps> = React.memo(
  ({
    trailsCount = mockTrails.length,
    onNavigateHub,
    onOpenLiveTracker,
    onOpenCommandPalette,
  }) => {
    const challengesCount = VIETNAM_SUMMIT_CHALLENGES.length;
    const rangersCount = VIETNAM_RANGER_STATIONS.length;

    const primaryHubs = useMemo<PrimaryHubCard[]>(
      () => [
        {
          id: 'passport',
          index: '01',
          title: `Hộ Chiếu Đỉnh & ${challengesCount} Thử Thách`,
          subtitle:
            'Ghi nhận dấu tem chinh phục các đỉnh 3.000m, theo dõi mốc độ cao tích lũy và bảng xếp hạng Trekker Việt Nam.',
          metric: `${trailsCount} đỉnh DEM · ${challengesCount} thử thách`,
          accent: 'var(--color-sun)',
          icon: <IconMountain size={20} color="var(--color-sun)" />,
        },
        {
          id: 'almanac',
          index: '02',
          title: 'Lịch Mùa 12 Tháng & Săn Mây',
          subtitle:
            'Ma trận khí hậu thực địa 12 tháng: nhận diện mùa săn biển mây Tây Bắc, hoa đỗ quyên và mùa bão lũ cần tránh.',
          metric: '12 tháng · 3 vùng khí hậu',
          accent: 'var(--color-sky)',
          icon: <IconCalendar size={20} color="var(--color-sky)" />,
        },
        {
          id: 'planner',
          index: '03',
          title: 'Thiết Kế GPX & Phân Tích Độ Dốc',
          subtitle:
            'Tự chấm cung trên bản đồ địa hình, lấy cao độ DEM thật, đo dốc từng chặng, tính Naismith/Tobler ETA và xuất GPX 1.1.',
          metric: 'DEM thật · GPX 1.1',
          accent: 'var(--color-primary)',
          icon: <IconCompass size={20} color="var(--color-primary)" />,
        },
        {
          id: 'toolkit',
          index: '04',
          title: 'Công Cụ Sinh Tồn Offline & La Bàn',
          subtitle:
            'La bàn GPS, giờ mặt trời NOAA, tính nước & calo, còi cứu nạn 3.1kHz, SOS 2G và các tình huống sơ cứu thực địa WFA.',
          metric: '100% hoạt động ngoại tuyến',
          accent: 'var(--color-earth)',
          icon: <IconSatellite size={20} color="var(--color-earth)" />,
        },
      ],
      [trailsCount, challengesCount]
    );

    const quickLaunchHubs = useMemo<QuickLaunchHub[]>(
      () => [
        {
          id: 'training',
          title: 'Giáo Án Thể Lực',
          caption: 'Lộ trình 4–8 tuần & điểm sẵn sàng',
          accent: 'var(--color-primary)',
          icon: <IconHiking size={16} color="var(--color-primary)" />,
        },
        {
          id: 'directory',
          title: 'Kiểm Lâm, Porter & Chi Phí',
          caption: `${rangersCount} trạm VQG & dự toán VNĐ`,
          accent: 'var(--color-stream)',
          icon: <IconShieldAlert size={16} color="var(--color-stream)" />,
        },
        {
          id: 'gear',
          title: 'Tủ Đồ & Tối Ưu Balo',
          caption: 'Phân tích Base Weight & tỉ lệ cơ thể',
          accent: 'var(--color-sun)',
          icon: <IconBackpack size={16} color="var(--color-sun)" />,
        },
        {
          id: 'radar',
          title: 'Radar An Toàn',
          caption: 'Cảnh báo sạt lở & tình trạng đường 7 ngày',
          accent: 'var(--color-error)',
          icon: <IconRadar size={16} color="var(--color-error)" />,
        },
      ],
      [rangersCount]
    );

    return (
      <section
        aria-label="Hệ sinh thái công cụ thực địa LOST"
        style={{
          maxWidth: 1360,
          width: '100%',
          margin: '0 auto',
          padding: '52px 0 16px',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Swiss Field-Atlas Section Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 18,
            marginBottom: 24,
            paddingBottom: 18,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--color-sun)',
                marginBottom: 8,
              }}
            >
              00 / HỆ SINH THÁI CÔNG CỤ THỰC ĐỊA
            </div>
            <h2
              className="font-editorial"
              style={{
                fontSize: 'clamp(1.55rem, 3vw, 2.2rem)',
                fontWeight: 700,
                color: 'var(--color-text-main)',
                margin: 0,
                lineHeight: 1.18,
                letterSpacing: '-0.02em',
              }}
            >
              Tám công cụ dã ngoại chuẩn địa hình — sẵn sàng cho mọi chuyến đi.
            </h2>
          </div>

          {/* Tactical Trigger Pills: Ctrl+K & Live GPS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="interactive-click"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 13px',
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <IconSearch size={14} color="var(--color-text-muted)" />
                <span>Tìm nhanh</span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.04em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  Ctrl+K
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => (onOpenLiveTracker ? onOpenLiveTracker() : onNavigateHub('toolkit'))}
              className="interactive-click"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-card))',
                border: '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)',
                color: 'var(--color-primary)',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              <IconRadio size={15} color="var(--color-primary)" />
              <span>Leo Núi Trực Tiếp (Live GPS)</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Flagship Hub Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          {primaryHubs.map((card, idx) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigateHub(card.id)}
              className="card card-hover-lift interactive-click scene-stagger-item"
              style={{
                textAlign: 'left',
                padding: '20px 20px 18px',
                borderRadius: 6,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderTop: `3px solid ${card.accent}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                fontFamily: 'var(--font-family)',
                ['--stagger-i' as string]: idx,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 4,
                      background: `color-mix(in srgb, ${card.accent} 13%, var(--color-bg-main))`,
                      border: `1px solid color-mix(in srgb, ${card.accent} 32%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {card.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      color: 'var(--color-text-dim)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    HUB {card.index}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 800,
                    color: 'var(--color-text-main)',
                    margin: '0 0 8px 0',
                    lineHeight: 1.3,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.58,
                    margin: 0,
                  }}
                >
                  {card.subtitle}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingTop: 12,
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: card.accent,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {card.metric}
                </span>
                <span
                  className="hub-card-arrow"
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: 'var(--color-text-main)',
                  }}
                >
                  <span>Mở công cụ</span>
                  <IconArrowRight size={13} color="var(--color-primary)" />
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* 4-Pill Secondary Quick-Launch Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
            gap: 10,
            padding: 10,
            borderRadius: 6,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          {quickLaunchHubs.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigateHub(item.id)}
              className="interactive-click scene-stagger-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-family)',
                ['--stagger-i' as string]: idx + 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 4,
                    background: `color-mix(in srgb, ${item.accent} 13%, var(--color-bg-card))`,
                    border: `1px solid color-mix(in srgb, ${item.accent} 30%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {item.caption}
                  </div>
                </div>
              </div>
              <IconArrowRight size={13} color="var(--color-text-dim)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </section>
    );
  }
);
