import React from 'react';
import { Compass, ShieldAlert, Radio, Mountain, PhoneCall, Heart, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, var(--color-bg-card) 0%, #030812 100%)',
        borderTop: '1px solid var(--color-border)',
        padding: '60px 24px 28px 24px',
        marginTop: 80,
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)',
        overflow: 'hidden',
      }}
    >
      {/* Top Glowing Gradient Accent Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%)',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.8)',
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
        {/* Column 1: Brand & Radio Beacon Status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              <Compass size={20} color="var(--color-primary)" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Trek<span style={{ color: 'var(--color-primary)' }}>Map</span> Việt Nam
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Nền tảng bản đồ trekking cộng đồng phi lợi nhuận lớn nhất Việt Nam. Tra cứu dữ liệu GPX đường đi thực tế, thông tin Porter bản địa & cứu hộ khẩn cấp 24/7.
          </p>

          {/* Live Radio Beacon Status Card */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
            }}
          >
            <span
              className="radar-pulse-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            <Radio size={14} />
            <span>VÔ TUYẾN 24/7 - TRẠM PHÁT TÍN HIỆU CỘNG ĐỒNG</span>
          </div>
        </div>

        {/* Column 2: Featured Trails Quick Access */}
        <div>
          <h4
            style={{
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Mountain size={17} color="var(--color-primary)" />
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>›</span>
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
              color: '#ef4444',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldAlert size={18} color="#ef4444" />
            Cứu Hộ Khẩn Cấp (SOS 24/7)
          </h4>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#f8fafc' }}>PCCC & Cứu nạn:</span>
              <a href="tel:114" style={{ color: '#ef4444', fontWeight: 900, fontSize: '1rem', textDecoration: 'none' }}>
                <PhoneCall size={13} style={{ display: 'inline', marginRight: 4 }} /> 114
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#f8fafc' }}>Cấp cứu Y tế Khẩn:</span>
              <a href="tel:115" style={{ color: '#ef4444', fontWeight: 900, fontSize: '1rem', textDecoration: 'none' }}>
                <PhoneCall size={13} style={{ display: 'inline', marginRight: 4 }} /> 115
              </a>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', paddingTop: 6, borderTop: '1px dashed rgba(239, 68, 68, 0.2)' }}>
              <div>• <strong>Kiểm Lâm Hoàng Liên (Sapa):</strong> 0214.3871.234</div>
              <div style={{ marginTop: 2 }}>• <strong>Cứu Hộ Tà Năng - Phan Dũng:</strong> 0918.999.111</div>
            </div>
          </div>
        </div>

        {/* Column 4: Safety Policy & Community Notice */}
        <div>
          <h4
            style={{
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldCheck size={18} color="#38bdf8" />
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
          <span>© 2026 TrekMap Việt Nam. Phát triển với</span>
          <Heart size={13} color="#ef4444" fill="#ef4444" />
          <span>bởi Cộng đồng Trekker Việt Nam.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', color: 'var(--color-primary)' }}>
            Phiên bản 2.5.0 (Pro GIS Engine)
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>Cộng đồng Trekking Việt Nam</span>
        </div>
      </div>
    </footer>
  );
};
