import React from 'react';
import {
  IconBackpack,
  IconHiking,
  IconTrash,
  IconFlame,
  IconTree,
  IconHeartHandshake,
  IconShieldAlert,
  IconPhone,
} from '../common/SvgIcons.js';

interface SafetyPledgeSectionProps {
  onOpenEmergencyContacts: () => void;
  onOpenIncidentReport?: () => void;
}

interface LntPrinciple {
  number: number;
  title: string;
  desc: string;
  iconName: string;
  IconComponent: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  accentColor: string;
}

const LNT_PRINCIPLES: LntPrinciple[] = [
  {
    number: 1,
    title: 'Chuẩn Bị & Lên Kế Hoạch',
    desc: 'Tìm hiểu kỹ địa hình, tải trước bản đồ offline GPX và chuẩn bị trang bị cứu thương khẩn cấp.',
    iconName: 'backpack',
    IconComponent: IconBackpack,
    accentColor: 'var(--color-primary)',
  },
  {
    number: 2,
    title: 'Đi & Cắm Trại Đúng Nơi',
    desc: 'Di chuyển theo lối mòn định sẵn, chỉ dựng lều trên bề mặt bền vững cách nguồn nước tối thiểu 60m.',
    iconName: 'hiking',
    IconComponent: IconHiking,
    accentColor: 'var(--color-sky)',
  },
  {
    number: 3,
    title: 'Xử Lý Rác Thải Đúng Cách',
    desc: 'Mang mọi thứ bạn mang vào ra khỏi rừng. Không để lại bất kỳ mẩu rác vô cơ hay vỏ nilong nào.',
    iconName: 'trash',
    IconComponent: IconTrash,
    accentColor: 'var(--color-earth)',
  },
  {
    number: 4,
    title: 'Bảo Tồn Nguyên Trạng',
    desc: 'Để nguyên hiện trạng cây cỏ, rêu đá và di tích lịch sử để người đi sau cùng thưởng ngoạn.',
    iconName: 'tree',
    IconComponent: IconTree,
    accentColor: 'var(--color-primary)',
  },
  {
    number: 5,
    title: 'Giảm Thiểu Tác Động Lửa',
    desc: 'Sử dụng bếp gas dã ngoại thay vì đốt lửa than. Dập tắt hoàn toàn tàn tro trước khi rời bãi trại.',
    iconName: 'flame',
    IconComponent: IconFlame,
    accentColor: 'var(--color-sun)',
  },
  {
    number: 6,
    title: 'Tôn Trọng Động Vật & Cộng Đồng',
    desc: 'Không gây tiếng ồn lớn giữa đêm, hòa nhã với dân bản địa và hỗ trợ đồng đội khi gặp hoạn nạn.',
    iconName: 'heart',
    IconComponent: IconHeartHandshake,
    accentColor: 'var(--color-stream)',
  },
];

export const SafetyPledgeSection: React.FC<SafetyPledgeSectionProps> = ({
  onOpenEmergencyContacts,
}) => {
  return (
    <section
      style={{
        padding: '50px 0',
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      {/* Container Box */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 28,
          padding: '40px 32px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px',
              borderRadius: 20,
              background: 'rgba(5, 150, 105, 0.12)',
              border: '1px solid var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 800,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}
          >
            <IconShieldAlert size={16} color="var(--color-primary)" />
            Quy Ước Rừng Nguyên Sinh
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
              fontWeight: 900,
              color: 'var(--color-text-main)',
              marginBottom: 10,
            }}
          >
            Leave No Trace • Không Để Lại Dấu Vết
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: 650, margin: '0 auto' }}>
            6 nguyên tắc cốt lõi bảo vệ vẻ đẹp hoang sơ của núi rừng Việt Nam và an toàn cho chính mỗi chuyến thám hiểm.
          </p>
        </div>

        {/* 6 Principles Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 18,
            marginBottom: 32,
          }}
        >
          {LNT_PRINCIPLES.map((p) => {
            const PrincipleIcon = p.IconComponent;
            return (
              <div
                key={p.number}
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 18,
                  padding: '20px 22px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'var(--color-bg-card)',
                    border: `1px solid ${p.accentColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PrincipleIcon size={20} color={p.accentColor} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: p.accentColor, fontFamily: 'monospace' }}>
                      #0{p.number}
                    </span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {p.title}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {p.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* SOS Emergency Hotline Quick Bar */}
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.06) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 18,
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconShieldAlert size={22} color="var(--color-error)" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-error)' }}>
                  Đường Dây Nóng Khẩn Cấp & Danh Bạ Kiểm Lâm
                </h4>
                <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                  24/7
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Lưu số trạm cứu hộ vườn quốc gia Hoàng Liên, Bidoup, Bù Gia Mập và công an khu vực trước khi xuất phát.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenEmergencyContacts}
            className="btn btn-danger"
            style={{
              padding: '10px 22px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <IconPhone size={16} color="#ffffff" />
            Tra Cứu Danh Bạ Cứu Hộ
          </button>
        </div>
      </div>
    </section>
  );
};
