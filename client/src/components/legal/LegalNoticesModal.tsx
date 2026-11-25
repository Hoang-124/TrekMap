import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  IconAlertTriangle,
  IconBookOpen,
  IconFileText,
  IconLock,
  IconMail,
  IconShieldAlert,
  IconShieldCheck,
  IconX,
} from '../common/SvgIcons.js';

export type LegalNoticeTab = 'terms' | 'privacy' | 'licenses';

interface LegalNoticesModalProps {
  isOpen: boolean;
  initialTab?: LegalNoticeTab;
  onClose: () => void;
  /** Render above an already-open modal (e.g. AuthModal) using --z-modal-nested */
  nested?: boolean;
}

const TAB_ITEMS: Array<{ id: LegalNoticeTab; label: string; shortLabel: string }> = [
  { id: 'terms', label: 'Điều khoản & Miễn trừ thực địa', shortLabel: 'Điều khoản' },
  { id: 'privacy', label: 'Bảo mật (NĐ 13/2023)', shortLabel: 'Bảo mật' },
  { id: 'licenses', label: 'Bản quyền & Ghi nhận nguồn', shortLabel: 'Bản quyền & Nguồn mở' },
];

export const LegalNoticesModal: React.FC<LegalNoticesModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
  nested = false,
}) => {
  const [activeTab, setActiveTab] = useState<LegalNoticeTab>(initialTab);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setActiveTab(initialTab);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialTab]);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: closeBtnRef });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape' && isTopmostFocusTrap(dialogRef.current)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const sectionCardStyle: React.CSSProperties = {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.88rem',
    fontWeight: 800,
    color: 'var(--color-text-main)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const bodyTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.82rem',
    lineHeight: 1.65,
    color: 'var(--color-text-muted)',
  };

  const listStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: '0.81rem',
    lineHeight: 1.6,
    color: 'var(--color-text-muted)',
  };

  const linkStyle: React.CSSProperties = {
    color: 'var(--color-primary)',
    fontWeight: 700,
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  };

  return createPortal(
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: nested ? 'var(--z-modal-nested, 3100)' : 'var(--z-modal, 3000)',
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-legal-modal-title"
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '88vh',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-3d)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--color-text-main)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px 14px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--color-bg-card)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
              }}
            >
              <IconShieldCheck size={14} color="var(--color-primary)" />
              <span>LOST Việt Nam · Pháp lý &amp; Tuân thủ</span>
            </div>
            <h2
              id="lost-legal-modal-title"
              style={{
                margin: 0,
                fontSize: '1.12rem',
                fontWeight: 800,
                color: 'var(--color-text-main)',
                letterSpacing: '-0.015em',
              }}
            >
              Điều khoản, Bảo mật dữ liệu &amp; Bản quyền nguồn mở
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ pháp lý"
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-elevated)',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <IconX size={16} color="currentColor" />
          </button>
        </div>

        {/* WAI-ARIA Tablist */}
        <div
          role="tablist"
          aria-label="Danh mục tài liệu pháp lý LOST"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {TAB_ITEMS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`legal-tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`legal-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '11px 14px',
                  border: 'none',
                  borderBottom: isSelected
                    ? '2px solid var(--color-primary)'
                    : '2px solid transparent',
                  background: 'transparent',
                  color: isSelected ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {tab.id === 'terms' && <IconShieldAlert size={14} color="currentColor" />}
                {tab.id === 'privacy' && <IconLock size={14} color="currentColor" />}
                {tab.id === 'licenses' && <IconBookOpen size={14} color="currentColor" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div
          className="modal-content"
          style={{
            padding: '18px 20px 22px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* TAB 1: TERMS & OUTDOOR DISCLAIMER */}
          {activeTab === 'terms' && (
            <div
              role="tabpanel"
              id="legal-panel-terms"
              aria-labelledby="legal-tab-terms"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div
                style={{
                  background: 'var(--banner-danger-bg)',
                  border: '1px solid var(--banner-danger-border)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <IconAlertTriangle
                  size={17}
                  color="var(--color-error-text)"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ fontSize: '0.84rem', color: 'var(--banner-danger-text)' }}>
                    Cảnh báo an toàn &amp; Miễn trừ trách nhiệm thực địa
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--banner-danger-text)' }}>
                    Leo núi, trekking và dã ngoại vùng sâu tiềm ẩn rủi ro nghiêm trọng (sạt lở, lũ quét, hạ thân nhiệt,
                    lạc đường, mất sóng viễn thông, động vật hoang dã). Mọi tuyến đường GPX, bản đồ địa hình 3D DEM,
                    dữ liệu thời tiết/khí hậu, công cụ SOS 2G và trợ lý AI trên LOST chỉ mang tính chất{' '}
                    <strong>tham khảo hỗ trợ</strong> — không thay thế chỉ dẫn chính thức của Kiểm lâm, Ban quản lý VQG,
                    hướng dẫn viên/Porter có chuyên môn hoặc lực lượng cứu nạn (112 / 114 / 115).
                  </p>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconFileText size={15} color="var(--color-primary)" />
                  <span>1. Phạm vi cung cấp &amp; Tự chịu trách nhiệm</span>
                </h3>
                <ul style={listStyle}>
                  <li>
                    Người dùng tự đánh giá thể lực, trang bị, tình trạng sức khỏe và điều kiện thời tiết thực tế trước
                    khi khởi hành; đồng thời chịu hoàn toàn trách nhiệm về quyết định di chuyển, xin giấy phép vào rừng
                    và tuân thủ quy định bảo vệ rừng tại địa phương.
                  </li>
                  <li>
                    Tín hiệu GPS, la bàn cảm biến, bộ đệm bản đồ ngoại tuyến và liên kết Live Beacon phụ thuộc phần cứng
                    thiết bị, pin và hạ tầng mạng. LOST không bảo đảm kết nối liên tục hoặc độ chính xác tuyệt đối tại
                    vùng địa hình hẻm núi, rừng rậm.
                  </li>
                  <li>
                    Các tính toán về tốc độ (Naismith/Tobler), lượng nước, điện giải và tư vấn AI không phải là chẩn
                    đoán hoặc chỉ định y khoa.
                  </li>
                </ul>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconShieldCheck size={15} color="var(--color-sky)" />
                  <span>2. Nội dung do người dùng đóng góp (UGC) &amp; Bản quyền</span>
                </h3>
                <ul style={listStyle}>
                  <li>
                    Khi đăng tải mô tả cung đường, tệp GPX, điểm thực địa (POI), nhật ký hành trình, đánh giá hoặc hình
                    ảnh, bạn cam kết mình là tác giả gốc hoặc sở hữu đầy đủ quyền hợp pháp (bao gồm quyền hình ảnh cá
                    nhân nếu có người xuất hiện trong ảnh) và không xâm phạm quyền sở hữu trí tuệ của bên thứ ba.
                  </li>
                  <li>
                    Bạn cấp cho LOST quyền không độc quyền, miễn phí bản quyền để lưu trữ, hiển thị, định dạng kỹ thuật
                    và phân phối nội dung đóng góp phục vụ cộng đồng trên nền tảng LOST.
                  </li>
                  <li>
                    Nghiêm cấm đăng tải tọa độ giả mạo gây nguy hiểm, thông tin liên hệ cá nhân của người khác khi chưa
                    có đồng thuận, hoặc nội dung vi phạm pháp luật Việt Nam. LOST có quyền ẩn, gỡ bỏ nội dung hoặc tạm
                    khóa tài khoản vi phạm.
                  </li>
                </ul>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconMail size={15} color="var(--color-earth)" />
                  <span>3. Tiếp nhận khiếu nại &amp; Yêu cầu gỡ bỏ nội dung</span>
                </h3>
                <p style={bodyTextStyle}>
                  Nếu bạn phát hiện dữ liệu sai lệch gây mất an toàn, vi phạm bản quyền hoặc thông tin cá nhân cần gỡ
                  bỏ, vui lòng liên hệ trực tiếp qua email{' '}
                  <a href="mailto:contact@lost.vn" style={linkStyle}>
                    contact@lost.vn
                  </a>{' '}
                  kèm đường dẫn cụ thể để đội ngũ xử lý trong thời gian sớm nhất.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY POLICY (DECREE 13/2023/ND-CP) */}
          {activeTab === 'privacy' && (
            <div
              role="tabpanel"
              id="legal-panel-privacy"
              aria-labelledby="legal-tab-privacy"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconLock size={15} color="var(--color-primary)" />
                  <span>1. Cam kết tuân thủ Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân</span>
                </h3>
                <p style={bodyTextStyle}>
                  LOST xử lý dữ liệu cá nhân theo nguyên tắc minh bạch, đúng mục đích và tối thiểu hóa dữ liệu theo quy
                  định tại Nghị định 13/2023/NĐ-CP của Chính phủ Việt Nam và các chuẩn mực bảo mật hiện hành. LOST{' '}
                  <strong>không bán</strong> dữ liệu cá nhân của người dùng cho bên thứ ba.
                </p>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconFileText size={15} color="var(--color-sky)" />
                  <span>2. Danh mục dữ liệu thu thập &amp; Mục đích xử lý</span>
                </h3>
                <ul style={listStyle}>
                  <li>
                    <strong>Thông tin tài khoản:</strong> Họ tên hiển thị, địa chỉ email, mật khẩu mã hóa một chiều
                    (PBKDF2-HMAC-SHA512) hoặc mã định danh Google OAuth (mã Google Identity Services chỉ được tải theo
                    yêu cầu khi bạn mở khung đăng nhập và chủ động chọn Đăng nhập bằng Google).
                  </li>
                  <li>
                    <strong>Dữ liệu an toàn &amp; cứu hộ (tự nguyện kích hoạt):</strong> Danh bạ liên hệ khẩn cấp (tên,
                    số điện thoại, email người thân), bộ hẹn giờ an toàn (Safety Timer) và tọa độ GPS Live Beacon khi
                    bạn chủ động phát liên kết theo dõi cho người thân (tự động hết hạn sau tối đa 48 giờ).
                  </li>
                  <li>
                    <strong>Thẻ y tế khẩn cấp ICE màn hình khóa:</strong> Thông tin nhóm máu, dị ứng, bệnh nền chỉ được
                    lưu cục bộ trên trình duyệt thiết bị của bạn để xuất ảnh PNG ngoại tuyến —{' '}
                    <strong>không bao giờ gửi lên máy chủ LOST</strong>.
                  </li>
                  <li>
                    <strong>Ảnh &amp; nội dung đóng góp:</strong> Ảnh do bạn tự tải lên được tự động xóa siêu dữ liệu
                    EXIF (tọa độ GPS gốc, thông tin máy ảnh) trên máy chủ trước khi lưu trữ để bảo vệ quyền riêng tư.
                  </li>
                  <li>
                    <strong>Phông chữ &amp; tài nguyên tĩnh:</strong> Phông chữ Plus Jakarta Sans được tự lưu trữ
                    (self-hosted) trực tiếp trên máy chủ LOST, không gửi địa chỉ IP người dùng tới máy chủ phông chữ bên
                    thứ ba.
                  </li>
                </ul>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconShieldCheck size={15} color="var(--color-primary)" />
                  <span>3. Thời hạn lưu trữ &amp; Quyền của chủ thể dữ liệu</span>
                </h3>
                <ul style={listStyle}>
                  <li>
                    <strong>Lưu trữ:</strong> Dữ liệu tài khoản được lưu trong thời gian tài khoản còn hoạt động; liên
                    kết Live Beacon tự động hết hạn theo TTL (tối đa 48 giờ); dữ liệu phiên cục bộ tự động được xóa sạch
                    khi đăng xuất.
                  </li>
                  <li>
                    <strong>Quyền của bạn (Điều 9 NĐ 13/2023/NĐ-CP):</strong> Bạn có quyền xem, chỉnh sửa, xuất dữ liệu
                    hồ sơ leo núi (CSV), rút lại sự đồng ý chia sẻ vị trí, và{' '}
                    <strong>xóa vĩnh viễn tài khoản</strong> trực tiếp trong phần Cài đặt Hồ sơ cá nhân hoặc gửi yêu cầu
                    tới{' '}
                    <a href="mailto:contact@lost.vn" style={linkStyle}>
                      contact@lost.vn
                    </a>
                    .
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: LICENSES & ATTRIBUTIONS */}
          {activeTab === 'licenses' && (
            <div
              role="tabpanel"
              id="legal-panel-licenses"
              aria-labelledby="legal-tab-licenses"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconShieldCheck size={15} color="var(--color-primary)" />
                  <span>1. Bản quyền nền tảng LOST</span>
                </h3>
                <p style={bodyTextStyle}>
                  © 2026 LOST Việt Nam. Toàn bộ mã nguồn ứng dụng, thiết kế giao diện Field-Atlas, đồ họa bìa địa hình
                  và biểu trưng LOST thuộc bản quyền của đội ngũ phát triển LOST (All Rights Reserved). Các thư viện mã
                  nguồn mở, phông chữ và nguồn dữ liệu mở tích hợp bên dưới tuân thủ đầy đủ giấy phép gốc tương ứng.
                </p>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconBookOpen size={15} color="var(--color-sky)" />
                  <span>2. Ghi nhận nguồn Bản đồ, Địa hình &amp; Dữ liệu Mở (Open Data)</span>
                </h3>
                <ul style={listStyle}>
                  <li>
                    <strong>Bản đồ Vector &amp; Kiểu hiển thị:</strong>{' '}
                    <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      OpenFreeMap
                    </a>{' '}
                    &amp;{' '}
                    <a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      OpenMapTiles
                    </a>{' '}
                    · Dữ liệu bản đồ &amp; địa chỉ ©{' '}
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      OpenStreetMap contributors
                    </a>{' '}
                    (giấy phép <strong>ODbL 1.0</strong>).
                  </li>
                  <li>
                    <strong>Dữ liệu cao độ &amp; Địa hình 3D DEM:</strong>{' '}
                    <a
                      href="https://registry.opendata.aws/terrain-tiles/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      AWS Open Data — Mapzen / Tilezen Terrarium Terrain Tiles
                    </a>{' '}
                    (tổng hợp từ SRTM/NASA, USGS, NOAA, GMTED, ETOPO1).
                  </li>
                  <li>
                    <strong>Dự báo thời tiết thực địa:</strong>{' '}
                    <a href="https://api.met.no/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      MET Norway (Norwegian Meteorological Institute)
                    </a>{' '}
                    — giấy phép <strong>CC BY 4.0</strong>.
                  </li>
                  <li>
                    <strong>Khí hậu lịch sử, Ảnh vệ tinh &amp; Cảnh báo thiên tai:</strong>{' '}
                    <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      NASA POWER
                    </a>
                    ,{' '}
                    <a
                      href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      NASA GIBS
                    </a>{' '}
                    &amp;{' '}
                    <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      NASA EONET
                    </a>{' '}
                    (<strong>US Government Public Domain</strong>).
                  </li>
                  <li>
                    <strong>Thuật toán thiên văn &amp; Mặt trời (Bình minh / Hoàng hôn / Giờ vàng):</strong>{' '}
                    <a
                      href="https://gml.noaa.gov/grad/solcalc/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      NOAA Solar Equations
                    </a>{' '}
                    (National Oceanic and Atmospheric Administration —{' '}
                    <strong>US Government Public Domain</strong>).
                  </li>
                  <li>
                    <strong>Định tuyến tham khảo (tùy chọn cấu hình):</strong>{' '}
                    <a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      openrouteservice by HeiGIT
                    </a>{' '}
                    | © OpenStreetMap contributors.
                  </li>
                  <li>
                    <strong>Xác thực tài khoản tùy chọn:</strong> Google Identity Services (chỉ tải theo yêu cầu khi
                    người dùng chủ động chọn Đăng nhập bằng Google, tuân thủ Điều khoản dịch vụ &amp; Chính sách quyền
                    riêng tư của Google).
                  </li>
                </ul>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconFileText size={15} color="var(--color-primary)" />
                  <span>3. Phông chữ, Biểu tượng &amp; Thư viện Mã nguồn Mở</span>
                </h3>
                <ul style={listStyle}>
                  <li>
                    <strong>Phông chữ Plus Jakarta Sans</strong> (The Plus Jakarta Sans Project Authors / Tokotype, tự
                    lưu trữ qua Fontsource) — giấy phép <strong>SIL Open Font License 1.1</strong>.
                  </li>
                  <li>
                    <strong>Hệ biểu tượng SVG thuần:</strong> Kế thừa phong cách hình học từ{' '}
                    <strong>Feather Icons (MIT License)</strong> và <strong>Lucide Icons (ISC License)</strong>.
                  </li>
                  <li>
                    <strong>Thư viện lõi:</strong> React &amp; React DOM (MIT), MapLibre GL JS (BSD-3-Clause, gồm thành
                    phần Mapbox GL JS v1.13 BSD-3-Clause, d3-color BSD-3-Clause &amp; glfx.js MIT), Socket.IO (MIT),
                    Express (MIT), cors (MIT), Mongoose (MIT), MongoDB Node Driver (Apache-2.0), Cloudinary SDK (MIT),
                    Nodemailer (MIT-0), dotenv (BSD-2-Clause).
                  </li>
                </ul>

                <div style={{ marginTop: 4 }}>
                  <a
                    href="/THIRD_PARTY_LICENSES.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border-strong)',
                      color: 'var(--color-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    <IconFileText size={14} color="currentColor" />
                    <span>Xem toàn văn giấy phép mã nguồn mở (/THIRD_PARTY_LICENSES.txt)</span>
                  </a>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>
                  <IconMail size={15} color="var(--color-earth)" />
                  <span>4. Tuyên bố Nhãn hiệu &amp; Kênh tiếp nhận yêu cầu bản quyền</span>
                </h3>
                <p style={bodyTextStyle}>
                  Mọi nhãn hiệu, tên thương mại và tên tổ chức bên thứ ba được nhắc tới (nếu có) thuộc quyền sở hữu của
                  chủ sở hữu tương ứng. LOST là nền tảng cộng đồng độc lập, không đại diện hay được bảo trợ chính thức
                  bởi các Vườn Quốc Gia, Khu Bảo Tồn hay cơ quan nhà nước. Mọi yêu cầu gỡ bỏ bản quyền hoặc phản hồi
                  pháp lý xin gửi về{' '}
                  <a href="mailto:contact@lost.vn" style={linkStyle}>
                    contact@lost.vn
                  </a>
                  .
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
            Liên hệ pháp lý &amp; bảo mật:{' '}
            <a href="mailto:contact@lost.vn" style={linkStyle}>
              contact@lost.vn
            </a>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 5,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
