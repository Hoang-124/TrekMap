import React from 'react';
import { IconShieldAlert, IconPhone } from './SvgIcons.js';

interface EmergencyContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyContactsModal: React.FC<EmergencyContactsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const contacts = [
    { title: '113 - Công An Quốc Gia', phone: '113', subtitle: 'Hỗ trợ an ninh & tìm kiếm cứu nạn khẩn cấp 24/7', color: '#ef4444' },
    { title: '114 - Cứu Hỏa & Cứu Hộ Rừng', phone: '114', subtitle: 'Đội ứng cứu sự cố thiên tai, cháy rừng & sạt lở', color: '#f59e0b' },
    { title: '115 - Cấp Cứu Y Tế Rừng', phone: '115', subtitle: 'Vận chuyển cấp cứu thương vong & y tế rừng núi', color: '#10b981' },
    { title: 'Trạm Kiểm Lâm VQG Hoàng Liên (Sa Pa)', phone: '02143871234', subtitle: 'Trạm cửa rừng Tôn - Đội tuần tra 24/7', color: '#38bdf8' },
    { title: 'Trạm Cứu Hộ Háng Đồng (Tà Xùa)', phone: '0988776554', subtitle: 'Đội cứu hộ địa phương chuyên trách núi cao', color: '#a855f7' },
    { title: 'SOS Quốc Tế & Cứu Nạn Núi 112', phone: '112', subtitle: 'Đầu số tìm kiếm cứu nạn tổng hợp Việt Nam', color: '#ec4899' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          width: '92%',
          padding: 24,
          borderRadius: 24,
          background: 'var(--color-bg-card)',
          border: '1.5px solid #ef4444',
          boxShadow: '0 25px 60px rgba(239, 68, 68, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShieldAlert size={20} color="#ef4444" />
            DANH BẠ HOTLINE CỨU HỘ KHẨN CẤP
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Danh sách số điện thoại cứu hộ, công an và trạm kiểm lâm cửa rừng. Bấm trực tiếp nút bên dưới để gọi khẩn cấp.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {contacts.map((item) => (
            <div
              key={item.phone}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                padding: '12px 16px',
                borderRadius: 14,
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {item.subtitle}
                </div>
              </div>

              <a
                href={`tel:${item.phone}`}
                className="btn btn-primary"
                style={{
                  background: item.color,
                  borderColor: item.color,
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  borderRadius: 10,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconPhone size={13} color="#ffffff" />
                Gọi {item.phone}
              </a>
            </div>
          ))}
        </div>

        <button
          className="btn btn-outline"
          onClick={onClose}
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}
        >
          Đóng Danh Bạ
        </button>
      </div>
    </div>
  );
};
