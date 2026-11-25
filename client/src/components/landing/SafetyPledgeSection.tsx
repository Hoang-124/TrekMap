import React, { useEffect, useState } from 'react';
import { IconPhone, IconShieldAlert, IconAlertTriangle } from '../common/SvgIcons.js';

interface SafetyPledgeSectionProps {
  onOpenEmergencyContacts: () => void;
  onOpenIncidentReport?: () => void;
}

const LNT_PRINCIPLES = [
  {
    number: '01',
    title: 'Chuẩn bị & lập kế hoạch kỹ',
    desc: 'Xem trước trắc diện cao độ, tải gói bản đồ offline và kiểm tra dự báo thời tiết trước giờ khởi hành.',
  },
  {
    number: '02',
    title: 'Đi & hạ trại đúng địa hình',
    desc: 'Bám sát lối mòn sẵn có, chỉ dựng lều trên mặt đất bền vững và cách nguồn nước tối thiểu 60 m.',
  },
  {
    number: '03',
    title: 'Mang toàn bộ rác ra khỏi rừng',
    desc: 'Không để lại vỏ nilon, pin, giấy ướt hay bất kỳ rác thải vô cơ nào trên đường mòn và bãi trại.',
  },
  {
    number: '04',
    title: 'Giữ nguyên hiện trạng tự nhiên',
    desc: 'Không bẻ cành, khắc tên lên thân cây hay xáo trộn đá rêu, giữ trọn vẻ hoang sơ cho người đi sau.',
  },
  {
    number: '05',
    title: 'Kiểm soát lửa trại an toàn',
    desc: 'Ưu tiên dùng bếp gas dã ngoại; nếu đốt lửa cần khoanh vùng đá và dập tắt hoàn toàn tàn tro trước khi rời đi.',
  },
  {
    number: '06',
    title: 'Tôn trọng thiên nhiên & bản địa',
    desc: 'Giữ yên tĩnh ban đêm, tôn trọng phong tục người dân địa phương và sẵn sàng hỗ trợ đồng đội khi cần.',
  },
];

export const SafetyPledgeSection: React.FC<SafetyPledgeSectionProps> = React.memo(({
  onOpenEmergencyContacts,
  onOpenIncidentReport,
}) => {
  const [isDesktopSticky, setIsDesktopSticky] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 901px)').matches
      : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 901px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopSticky(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <section
      style={{
        padding: '64px 0 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      <div
        className="manifesto-split-grid"
        style={{
          borderTop: '1px solid var(--color-border-strong)',
          paddingTop: 44,
        }}
      >
        {/* LEFT STICKY EDITORIAL MANIFESTO & EMERGENCY DISPATCH (Desktop-only sticky) */}
        <div style={isDesktopSticky ? { position: 'sticky', top: 88 } : undefined}>
          <div className="section-eyebrow">05 / Quy ước đi rừng</div>
          <h2
            className="font-editorial"
            style={{
              fontSize: 'clamp(2rem, 3.6vw, 3rem)',
              fontWeight: 500,
              color: 'var(--color-text-main)',
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              margin: '0 0 18px 0',
            }}
          >
            Đi không để lại dấu chân.{' '}
            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              Về không mang gì ngoài ký ức.
            </span>
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.65, margin: '0 0 28px 0' }}>
            Sáu nguyên tắc tối thiểu Leave No Trace giữ trọn vẻ hoang sơ của núi rừng Việt Nam và bảo vệ an toàn cho chính mỗi đoàn leo núi.
          </p>

          {/* Swiss Emergency Dispatch Card */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-error)',
              borderRadius: 4,
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <IconShieldAlert size={16} color="var(--color-error-text, var(--color-error))" />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-error-text, var(--color-error))' }}>
                Cứu hộ khẩn cấp 24/7
              </span>
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.55, marginBottom: 14 }}>
              Tổng đài 112 / 114 / 115, danh bạ kiểm lâm VQG và công cụ hẹn giờ báo bình an &amp; soạn tin nhắn SOS qua sóng 2G.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={onOpenEmergencyContacts}
                className="btn btn-danger"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 4,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                <IconPhone size={14} color="var(--color-on-danger)" />
                <span>Mở danh bạ cứu hộ &amp; SOS 2G</span>
              </button>

              {onOpenIncidentReport && (
                <button
                  type="button"
                  onClick={onOpenIncidentReport}
                  className="btn btn-outline"
                  style={{
                    width: '100%',
                    padding: '9px 16px',
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                    color: 'var(--color-error-text, var(--color-error))',
                  }}
                >
                  <IconAlertTriangle size={14} color="var(--color-error-text, var(--color-error))" />
                  <span>Báo cáo sự cố thực địa</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Editorial Numbered Manifesto Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {LNT_PRINCIPLES.map((p, idx) => (
            <div
              key={p.number}
              className="lnt-ledger-row scene-stagger-item"
              style={{
                display: 'grid',
                gridTemplateColumns: '64px minmax(0, 1fr)',
                gap: 16,
                padding: '22px 8px',
                borderBottom: '1px solid var(--color-border)',
                alignItems: 'baseline',
                ['--stagger-i' as string]: idx,
              }}
            >
              <span
                className="font-editorial"
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 400,
                  color: 'var(--color-text-dim)',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {p.number}
              </span>
              <div>
                <h3
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    margin: '0 0 6px 0',
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: '0.86rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
