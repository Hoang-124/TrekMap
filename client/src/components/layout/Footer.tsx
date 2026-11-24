import React, { useState } from 'react';
import { IconShieldAlert } from '../common/SvgIcons.js';
import { LegalNoticesModal, type LegalNoticeTab } from '../legal/LegalNoticesModal.js';

const FEATURED_TRAIL_LINKS = [
  { id: 'trail-fansipan', name: 'Fansipan (3,143m) - Nóc nhà Đông Dương' },
  { id: 'trail-laothan', name: 'Lảo Thẩn (2,860m) - Săn mây Y Tý' },
  { id: 'trail-taxua', name: 'Tà Xùa (2,865m) - Sống lưng Khủng Long' },
  { id: 'trail-kyquansan', name: 'Bạch Mộc Lương Tử (3,046m) - Kỳ Quan San' },
  { id: 'trail-tanangphandung', name: 'Tà Năng - Phan Dũng - Cung trekking huyền thoại' },
];

export const Footer: React.FC = React.memo(() => {
  const [legalTab, setLegalTab] = useState<LegalNoticeTab | null>(null);

  const handleSpaTrailClick = (e: React.MouseEvent<HTMLAnchorElement>, trailId: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const targetPath = `/trails/${encodeURIComponent(trailId)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      style={{
        position: 'relative',
        background: 'var(--color-bg-card)',
        borderTop: '1px solid var(--color-border)',
        padding: '52px 24px 28px 24px',
        marginTop: 72,
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 36,
          marginBottom: 42,
        }}
      >
        {/* Column 1: Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: 'var(--color-text-main)',
                letterSpacing: '0.06em',
              }}
            >
              LOST<span style={{ color: 'var(--color-primary)' }}>.</span>
            </span>
          </div>

          <p style={{ fontSize: '0.84rem', lineHeight: 1.65, color: 'var(--color-text-muted)', margin: 0 }}>
            LOST là bản đồ cộng đồng lưu giữ các cung đường trekking hoang sơ tại Việt Nam — với
            tracklog GPX thực địa, bản đồ 3D DEM, gói tải offline và danh bạ kiểm lâm cứu hộ 24/7.
          </p>
        </div>

        {/* Column 2: Featured Trails (SPA Navigation) */}
        <div>
          <h4
            style={{
              color: 'var(--color-text-main)',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            Cung Đường Trọng Điểm
          </h4>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {FEATURED_TRAIL_LINKS.map((item) => (
              <li key={item.id}>
                <a
                  href={`/trails/${item.id}`}
                  onClick={(e) => handleSpaTrailClick(e, item.id)}
                  style={{
                    color: 'var(--color-text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.82rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 900 }}>
                    ›
                  </span>
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Emergency Rescue Hotlines */}
        <div>
          <h4
            style={{
              color: 'var(--color-error-text, var(--color-error))',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconShieldAlert size={16} color="var(--color-error-text, var(--color-error))" />
            Cứu Hộ Khẩn Cấp (SOS 24/7)
          </h4>
          <div
            style={{
              background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
              borderRadius: 6,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 600 }}>
                PCCC &amp; Cứu nạn:
              </span>
              <a
                href="tel:114"
                style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 900, fontSize: '1rem', textDecoration: 'none' }}
              >
                114
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 600 }}>
                Cấp cứu Y tế Khẩn:
              </span>
              <a
                href="tel:115"
                style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 900, fontSize: '1rem', textDecoration: 'none' }}
              >
                115
              </a>
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                paddingTop: 6,
                borderTop: '1px dashed color-mix(in srgb, var(--color-error) 28%, transparent)',
              }}
            >
              <div>
                - <strong>Tìm kiếm Cứu nạn Quốc gia:</strong>{' '}
                <a href="tel:112" style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, textDecoration: 'none' }}>
                  112
                </a>
              </div>
              <div style={{ marginTop: 2 }}>
                - <strong>VQG Hoàng Liên (Sa Pa):</strong>{' '}
                <a
                  href="tel:02143871494"
                  style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, textDecoration: 'none' }}
                >
                  02143.871.494
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Column 4: Safety Policy */}
        <div>
          <h4
            style={{
              color: 'var(--color-text-main)',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            An Toàn Là Trên Hết
          </h4>
          <p style={{ fontSize: '0.82rem', lineHeight: 1.65, color: 'var(--color-text-muted)', margin: 0 }}>
            Mọi thông tin trên LOST do cộng đồng người đi thực tế chia sẻ và đóng góp. Trekking là
            hoạt động mạo hiểm có rủi ro thiên nhiên. Trekker cần kiểm tra thời tiết, tự chuẩn bị
            thể lực kỹ lưỡng và thuê Porter/Guide bản địa có chuyên môn trước khi khởi hành.
          </p>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: 22,
          maxWidth: 1320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: '0.76rem',
          color: 'var(--color-text-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>© 2026 LOST Việt Nam — Bản đồ những cung đường hoang sơ.</span>
        </div>

        <nav
          aria-label="Liên kết pháp lý và nguồn mở"
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}
        >
          <button
            type="button"
            onClick={() => setLegalTab('terms')}
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              transition: 'color 0.15s ease',
            }}
          >
            Điều khoản &amp; Miễn trừ
          </button>
          <button
            type="button"
            onClick={() => setLegalTab('privacy')}
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              transition: 'color 0.15s ease',
            }}
          >
            Bảo mật (NĐ 13/2023)
          </button>
          <button
            type="button"
            onClick={() => setLegalTab('licenses')}
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              transition: 'color 0.15s ease',
            }}
          >
            Bản quyền &amp; Nguồn mở
          </button>
          <a
            href="/THIRD_PARTY_LICENSES.txt"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--color-primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            THIRD_PARTY_LICENSES.txt
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            v2.6 · 3D DEM &amp; Offline Atlas
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>Cộng đồng Trekking Việt Nam</span>
        </div>
      </div>

      {/* Monumental Editorial Monolith Wordmark */}
      <div className="monolith-wordmark" aria-hidden="true">
        LOST<span style={{ color: 'var(--color-primary)' }}>.</span>
      </div>

      <LegalNoticesModal
        isOpen={legalTab !== null}
        initialTab={legalTab ?? 'terms'}
        onClose={() => setLegalTab(null)}
      />
    </footer>
  );
});
