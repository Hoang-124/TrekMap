import React from 'react';
import { IconShieldAlert, IconRadio } from '../common/SvgIcons.js';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        position: 'relative',
        background: 'var(--color-bg-card)',
        borderTop: '1px solid var(--color-border)',
        padding: '60px 24px 28px 24px',
        marginTop: 80,
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)',
        boxShadow: 'var(--shadow-header)',
        overflow: 'hidden',
      }}
    >
      {/* Top Ambient Glow Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, var(--color-primary) 50%, transparent 100%)',
          boxShadow: '0 0 12px var(--color-border-glow)',
        }}
      />

      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 40,
          marginBottom: 48,
        }}
      >
        {/* Column 1: Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>
              Trek<span style={{ color: 'var(--color-primary)' }}>Map</span> Việt Nam
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Nền tảng bản đồ trekking cộng đồng phi lợi nhuận lớn nhất Việt Nam. Tra cứu dữ liệu GPX đường đi thực tế, thông tin Porter bản địa & cứu hộ khẩn cấp 24/7.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid var(--color-border-glow)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
            }}
          >
            <IconRadio size={14} color="var(--color-primary)" />
            <span>VÔ TUYẾN 24/7 - TRẠM PHÁT TÍN HIỆU CỘNG ĐỒNG</span>
          </div>
        </div>

        {/* Column 2: Featured Trails */}
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
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Fansipan (3,143m) - Nóc nhà Đông Dương', link: '/forum?threadId=thread-1785160414886' },
              { name: 'Lảo Thẩn (2,860m) - Săn mây Y Tý', link: '/forum?threadId=thread-1785160414886' },
              { name: 'Tà Xùa (2,875m) - Sống lưng Khủng Long', link: '/forum?threadId=thread-1785160414886' },
              { name: 'Bạch Mộc Lương Tử (3,046m) - Kỳ Quan San', link: '/forum?threadId=thread-1785160414886' },
              { name: 'Tà Năng - Phan Dũng - Cung trekking huyền thoại', link: '/forum?threadId=thread-1785160414886' },
            ].map((item, idx) => (
              <li key={idx}>
                <a
                  href={item.link}
                  style={{
                    color: 'var(--color-text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.82rem',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 900 }}>›</span>
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
              color: 'var(--color-error)',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconShieldAlert size={16} color="var(--color-error)" />
            Cứu Hộ Khẩn Cấp (SOS 24/7)
          </h4>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 600 }}>PCCC & Cứu nạn:</span>
              <a href="tel:114" style={{ color: 'var(--color-error)', fontWeight: 900, fontSize: '1rem', textDecoration: 'none' }}>
                114
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 600 }}>Cấp cứu Y tế Khẩn:</span>
              <a href="tel:115" style={{ color: 'var(--color-error)', fontWeight: 900, fontSize: '1rem', textDecoration: 'none' }}>
                115
              </a>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', paddingTop: 6, borderTop: '1px dashed rgba(239, 68, 68, 0.25)' }}>
              <div>- <strong>Kiểm Lâm Hoàng Liên:</strong> 0214.3871.234</div>
              <div style={{ marginTop: 2 }}>- <strong>Cứu Hộ Tà Năng - Phan Dũng:</strong> 0918.999.111</div>
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
            Mọi thông tin trên TrekMap do cộng đồng người đi thực tế đóng góp. Trekking là hoạt động mạo hiểm có rủi ro thiên nhiên. Trekker cần kiểm tra thời tiết, tự chuẩn bị thể lực kỹ lưỡng và thuê Porter/Guide bản địa có chuyên môn trước khi khởi hành.
          </p>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: 24,
          maxWidth: 1320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: '0.78rem',
          color: 'var(--color-text-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>© 2026 TrekMap Việt Nam. Phát triển bởi Cộng đồng Trekker Việt Nam.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: 8, fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
            Phiên bản 2.5.0 (Pro GIS Engine)
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>Cộng đồng Trekking Việt Nam</span>
        </div>
      </div>
    </footer>
  );
};
