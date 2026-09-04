import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { submitTrailContribution, uploadImageToCloudinary } from '../../services/api.js';
import type { Region, UserProfile, Waypoint } from '../../types.js';
import {
  IconCompass,
  IconMapPin,
  IconMountain,
  IconCalendar,
  IconAlertTriangle,
  IconShieldCheck,
  IconSend,
  IconLightbulb,
} from '../common/SvgIcons.js';

const ArrowLeft = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRight = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// Custom Leaflet Pin Icons
const greenPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [26, 42],
  iconAnchor: [13, 42],
  popupAnchor: [1, -34],
  shadowSize: [42, 42],
});

const redPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [26, 42],
  iconAnchor: [13, 42],
  popupAnchor: [1, -34],
  shadowSize: [42, 42],
});

function MapClickListener({ onSelectCoords }: { onSelectCoords: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelectCoords(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    },
  });
  return null;
}

interface ProvinceData {
  name: string;
  wards: string[];
}

const VIETNAM_ADMINISTRATIVE_DATA: Record<string, ProvinceData[]> = {
  'Miền Bắc': [
    { name: 'Thành phố Hà Nội', wards: ['Phường Ba Đình', 'Phường Hoàn Kiếm', 'Xã Ba Vì', 'Xã Hương Sơn', 'Xã Sóc Sơn'] },
    { name: 'Tỉnh Lào Cai', wards: ['Phường Sa Pa', 'Xã Y Tý', 'Xã Bát Xát', 'Xã Mường Hum', 'Xã Tả Van', 'Xã Bản Hồ', 'Xã Ngũ Chỉ Sơn', 'Xã Tả Phìn'] },
    { name: 'Tỉnh Yên Bái', wards: ['Phường Nghĩa Lộ', 'Xã Trạm Tấu', 'Xã Mù Cang Chải', 'Xã Xà Hồ', 'Xã Tú Lệ', 'Xã La Pán Tẩn'] },
    { name: 'Tỉnh Hà Giang', wards: ['Phường Hà Giang', 'Xã Đồng Văn', 'Xã Mèo Vạc', 'Xã Lũng Cú', 'Xã Thông Nguyên', 'Xã Quản Bạ'] },
    { name: 'Tỉnh Lai Châu', wards: ['Phường Lai Châu', 'Xã Tam Đường', 'Xã Tả Liên', 'Xã Sơn Bình', 'Xã Hồ Thầu', 'Xã Sìn Hồ'] },
    { name: 'Tỉnh Sơn La', wards: ['Phường Sơn La', 'Xã Bắc Yên', 'Xã Tà Xùa', 'Phường Mộc Châu', 'Xã Vân Hồ'] },
    { name: 'Tỉnh Hòa Bình', wards: ['Phường Hòa Bình', 'Xã Mai Châu', 'Xã Hang Kia', 'Xã Pà Cò', 'Xã Cao Phong'] },
    { name: 'Tỉnh Cao Bằng', wards: ['Phường Cao Bằng', 'Xã Trùng Khánh', 'Xã Đàm Thủy', 'Xã Hà Quảng', 'Xã Nguyên Bình'] },
    { name: 'Tỉnh Lạng Sơn', wards: ['Phường Lạng Sơn', 'Xã Mẫu Sơn', 'Xã Hữu Lũng', 'Xã Chi Lăng'] },
    { name: 'Tỉnh Quảng Ninh', wards: ['Thành phố Hạ Long', 'Phường Yên Tử', 'Xã Bình Liêu', 'Xã Cô Tô'] },
  ],
  'Miền Trung': [
    { name: 'Thành phố Đà Nẵng', wards: ['Phường Sơn Trà', 'Phường Thọ Quang', 'Phường Hải Châu', 'Xã Hòa Bắc', 'Xã Hòa Vang'] },
    { name: 'Thành phố Huế', wards: ['Phường Huế', 'Phường Thuận Thành', 'Xã Bạch Mã', 'Xã A Lưới', 'Xã Nam Đông'] },
    { name: 'Tỉnh Quảng Bình', wards: ['Thành phố Đồng Hới', 'Xã Phong Nha - Kẻ Bàng', 'Xã Tân Hóa', 'Xã Bố Trạch'] },
    { name: 'Tỉnh Quảng Nam', wards: ['Thành phố Hội An', 'Thành phố Tam Kỳ', 'Xã Nam Trà My', 'Xã Phước Sơn'] },
    { name: 'Thành phố Đà Lạt (Lâm Đồng)', wards: ['Phường Đà Lạt', 'Phường Xuân Thọ', 'Xã Lạc Dương', 'Xã Bidoup', 'Xã Tà Năng', 'Xã Phan Dũng'] },
    { name: 'Tỉnh Đắk Lắk', wards: ['Thành phố Buôn Ma Thuột', 'Xã Krông Bông', 'Xã Buôn Đôn', 'Xã Lắk'] },
    { name: 'Tỉnh Gia Lai', wards: ['Thành phố Pleiku', 'Xã Chư Đăng Ya', 'Xã Kbang', 'Xã Mang Yang'] },
    { name: 'Tỉnh Kon Tum', wards: ['Thành phố Kon Tum', 'Xã Măng Đen', 'Xã Đắk Glei', 'Xã Tu Mơ Rông'] },
    { name: 'Tỉnh Ninh Thuận', wards: ['Thành phố Phan Rang', 'Xã Phước Bình', 'Xã Vĩnh Hy'] },
    { name: 'Tỉnh Bình Thuận', wards: ['Thành phố Phan Thiết', 'Xã Phan Dũng', 'Xã Tánh Linh'] },
  ],
  'Miền Nam': [
    { name: 'Thành phố Hồ Chí Minh', wards: ['Phường TP. Thủ Đức', 'Xã Cần Giờ', 'Xã Củ Chi', 'Phường Quận 1'] },
    { name: 'Tỉnh Bà Rịa - Vũng Tàu', wards: ['Thành phố Vũng Tàu', 'Thành phố Bà Rịa', 'Xã Núi Dinh', 'Xã Xuyên Mộc'] },
    { name: 'Tỉnh Đồng Nai', wards: ['Thành phố Biên Hòa', 'Xã Nam Cát Tiên', 'Xã Chứa Chan'] },
    { name: 'Tỉnh Tây Ninh', wards: ['Thành phố Tây Ninh', 'Phường Ninh Sơn', 'Xã Tân Biên'] },
    { name: 'Tỉnh An Giang', wards: ['Thành phố Long Xuyên', 'Thành phố Châu Đốc', 'Xã An Hảo', 'Xã Tri Tôn'] },
    { name: 'Tỉnh Kiên Giang', wards: ['Thành phố Phú Quốc', 'Thành phố Rạch Giá', 'Xã Nam Du'] },
  ],
};

const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  'Thành phố Đà Nẵng': [16.0544, 108.2022],
  'Tỉnh Lào Cai': [22.3364, 103.8438],
  'Tỉnh Yên Bái': [21.7052, 104.8705],
  'Tỉnh Hà Giang': [22.8233, 104.9839],
  'Tỉnh Lai Châu': [22.3963, 103.4586],
  'Tỉnh Sơn La': [21.3257, 103.9188],
  'Tỉnh Hòa Bình': [20.8156, 105.3384],
  'Tỉnh Cao Bằng': [22.6663, 106.2625],
  'Thành phố Huế': [16.4637, 107.5909],
  'Tỉnh Quảng Bình': [17.4687, 106.6227],
  'Tỉnh Quảng Nam': [15.567, 108.0],
  'Thành phố Đà Lạt (Lâm Đồng)': [11.9404, 108.4583],
  'Tỉnh Đắk Lắk': [12.6667, 108.05],
  'Tỉnh Gia Lai': [13.9833, 108.0],
  'Thành phố Hà Nội': [21.0285, 105.8542],
  'Thành phố Hồ Chí Minh': [10.8231, 106.6297],
  'Tỉnh Bà Rịa - Vũng Tàu': [10.346, 107.0843],
  'Tỉnh Tây Ninh': [11.3108, 106.0984],
  'Tỉnh An Giang': [10.3759, 105.4185],
};

interface WizardProps {
  onBack: () => void;
  onSuccess: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: UserProfile | null;
}

export const TrailContributionWizard: React.FC<WizardProps> = ({ onBack, onSuccess, onShowToast, currentUser }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isCustomWard, setIsCustomWard] = useState(false);
  const [customWardText, setCustomWardText] = useState('');

  const isEditing = !!localStorage.getItem('trekmap_editing_contribution');
  const [pinMode, setPinMode] = useState<'start' | 'end'>('start');
  const [mapTileType, setMapTileType] = useState<'satellite' | 'terrain' | 'osm'>('satellite');
  const [gpxTrack, setGpxTrack] = useState<[number, number][]>([]);
  const [gpxFileName, setGpxFileName] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Form State adhering 100% to MongoDB Trail & Contribution schema
  const [formData, setFormData] = useState({
    name: '',
    altNames: '',
    province: 'Tỉnh Lào Cai',
    district: 'Phường Sa Pa',
    hamlet: 'Bản Cát Cát (Trạm cửa rừng)',
    region: 'Miền Bắc' as Region,
    distanceKm: 15,
    elevationGainM: 800,
    maxAltitudeM: 2000,
    durationDays: 1,
    durationHoursNote: '1 ngày',
    difficultyLevel: 3,
    difficultyNote: 'Đường dốc đá, cần thể lực tốt',
    bestMonths: [10, 11, 12, 1, 2, 3, 4] as number[],
    avoidMonths: [6, 7, 8] as number[],
    description: '',
    transportationInfo: '',
    coverImage: '',
    permitRequired: false,
    permitInfo: '',
    hasCampsite: true,
    hasWaterSource: true,
    kidFriendly: false,
    rescueContact: {
      name: 'Hạt Kiểm Lâm Lào Cai',
      phone: '02143.871.228',
      rangerContact: 'Trạm Kiểm Lâm Trạm Tôn',
    },
    waypoints: [] as Waypoint[],
    startLat: 22.3364,
    startLng: 103.8438,
    endLat: 22.3512,
    endLng: 103.864,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const editingStr = localStorage.getItem('trekmap_editing_contribution');
    if (editingStr) {
      try {
        const editingItem = JSON.parse(editingStr);
        setFormData((prev) => ({
          ...prev,
          ...editingItem,
          altNames: Array.isArray(editingItem.altNames) ? editingItem.altNames.join(', ') : editingItem.altNames || '',
          bestMonths: editingItem.bestMonths || [10, 11, 12, 1, 2, 3, 4],
          avoidMonths: editingItem.avoidMonths || [6, 7, 8],
          rescueContact: editingItem.rescueContact || prev.rescueContact,
        }));
        if (editingItem.gpxTrack && Array.isArray(editingItem.gpxTrack)) {
          setGpxTrack(editingItem.gpxTrack);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 760, margin: '60px auto', padding: '48px 32px', textAlign: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 24, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.12)', width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
          <IconCompass size={32} color="var(--color-primary)" />
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 12 }}>
          Yêu Cầu Đăng Nhập Để Đóng Góp Cung Đường
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: 28, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 28px auto' }}>
          Để đảm bảo tính xác thực 100% dữ liệu thực địa trên Database và ghi nhận điểm thưởng Trekker (+50 điểm), bạn cần đăng nhập trước khi đóng góp.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
          <button className="btn btn-outline" onClick={onBack} style={{ borderRadius: 12, padding: '10px 24px', fontSize: '0.9rem' }}>Quay lại</button>
          <button className="btn btn-primary" onClick={() => { window.location.hash = '#login'; }} style={{ borderRadius: 12, padding: '10px 28px', fontSize: '0.9rem', fontWeight: 700 }}>Đăng nhập ngay</button>
        </div>
      </div>
    );
  }

  const handleRegionChange = (newRegion: Region) => {
    const provinces = VIETNAM_ADMINISTRATIVE_DATA[newRegion] || [];
    const firstProvince = provinces[0]?.name || '';
    const firstWard = provinces[0]?.wards[0] || '';
    setIsCustomWard(false);
    setFormData((prev) => ({
      ...prev,
      region: newRegion,
      province: firstProvince,
      district: firstWard,
      rescueContact: {
        ...prev.rescueContact,
        name: `Hạt Kiểm Lâm ${firstProvince.replace(/^(Tỉnh |Thành phố )/, '')}`,
      },
    }));
  };

  const handleProvinceChange = (newProvince: string) => {
    const provinces = VIETNAM_ADMINISTRATIVE_DATA[formData.region] || [];
    const found = provinces.find((p) => p.name === newProvince);
    const firstWard = found?.wards[0] || '';
    setIsCustomWard(false);
    setFormData((prev) => ({
      ...prev,
      province: newProvince,
      district: firstWard,
      rescueContact: {
        ...prev.rescueContact,
        name: `Hạt Kiểm Lâm ${newProvince.replace(/^(Tỉnh |Thành phố )/, '')}`,
      },
    }));
  };

  const handleWardSelect = (val: string) => {
    if (val === 'CUSTOM_WARD_OPTION') {
      setIsCustomWard(true);
      setFormData((prev) => ({ ...prev, district: customWardText || 'Phường / Xã mới' }));
    } else {
      setIsCustomWard(false);
      setFormData((prev) => ({ ...prev, district: val }));
    }
  };

  const handleToggleMonth = (m: number) => {
    const isBest = formData.bestMonths.includes(m);
    const isAvoid = formData.avoidMonths.includes(m);

    if (!isBest && !isAvoid) {
      setFormData((prev) => ({ ...prev, bestMonths: [...prev.bestMonths, m].sort((a, b) => a - b) }));
    } else if (isBest) {
      setFormData((prev) => ({
        ...prev,
        bestMonths: prev.bestMonths.filter((x) => x !== m),
        avoidMonths: [...prev.avoidMonths, m].sort((a, b) => a - b),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        avoidMonths: prev.avoidMonths.filter((x) => x !== m),
      }));
    }
  };

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const uploadedUrl = await uploadImageToCloudinary(base64, file.name, 'trails');
        setFormData((prev) => ({ ...prev, coverImage: uploadedUrl }));
        if (errors.coverImage) {
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.coverImage;
            return copy;
          });
        }
      } catch (err) {
        onShowToast?.('Không thể tải ảnh lên Cloudinary, vui lòng thử lại.', 'error');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpxFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const trkpts = Array.from(xmlDoc.querySelectorAll('trkpt'));
        if (trkpts.length > 0) {
          const points: [number, number][] = trkpts
            .map((pt) => [
              parseFloat(pt.getAttribute('lat') || '0'),
              parseFloat(pt.getAttribute('lon') || '0'),
            ] as [number, number])
            .filter(([lat, lng]) => lat !== 0 && lng !== 0);

          if (points.length > 0) {
            const start = points[0];
            const end = points[points.length - 1];
            setGpxTrack(points);
            setFormData((prev) => ({
              ...prev,
              startLat: Number(start[0].toFixed(5)),
              startLng: Number(start[1].toFixed(5)),
              endLat: Number(end[0].toFixed(5)),
              endLng: Number(end[1].toFixed(5)),
            }));
            onShowToast?.(`Đã trích xuất ${points.length} điểm GPS thực địa từ tệp GPX!`, 'success');
          }
        }
      } catch (err) {
        console.error('GPX parse error:', err);
      }
    };
    reader.readAsText(file);
  };

  // Comprehensive Step Validations
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      errs.name = 'Tên cung đường bắt buộc và phải có ít nhất 3 ký tự.';
    }
    if (!formData.hamlet.trim() || formData.hamlet.trim().length < 2) {
      errs.hamlet = 'Vui lòng nhập điểm xuất phát (Thôn/Bản/Cửa rừng).';
    }
    if (!formData.province.trim() || !formData.district.trim()) {
      errs.district = 'Vui lòng chọn đầy đủ Tỉnh và Phường/Xã.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Vui lòng hoàn thành đầy đủ thông tin tại Bước 1!', 'error');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.distanceKm || formData.distanceKm <= 0) {
      errs.distanceKm = 'Độ dài cung đường phải lớn hơn 0 km.';
    }
    if (formData.elevationGainM === undefined || formData.elevationGainM < 0) {
      errs.elevationGainM = 'Độ cao nâng không được là số âm.';
    }
    if (!formData.maxAltitudeM || formData.maxAltitudeM <= 0) {
      errs.maxAltitudeM = 'Cao độ đỉnh núi phải lớn hơn 0 m.';
    }
    if (formData.bestMonths.length === 0) {
      errs.bestMonths = 'Vui lòng chọn ít nhất 1 tháng lý tưởng nhất để leo núi.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Vui lòng kiểm tra lại thông số kỹ thuật & mùa leo tại Bước 2!', 'error');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (isNaN(formData.startLat) || formData.startLat < -90 || formData.startLat > 90) {
      errs.startLat = 'Vĩ độ xuất phát không hợp lệ (-90 đến 90).';
    }
    if (isNaN(formData.startLng) || formData.startLng < -180 || formData.startLng > 180) {
      errs.startLng = 'Kinh độ xuất phát không hợp lệ (-180 đến 180).';
    }
    if (isNaN(formData.endLat) || formData.endLat < -90 || formData.endLat > 90) {
      errs.endLat = 'Vĩ độ kết thúc không hợp lệ (-90 đến 90).';
    }
    if (isNaN(formData.endLng) || formData.endLng < -180 || formData.endLng > 180) {
      errs.endLng = 'Kinh độ kết thúc không hợp lệ (-180 đến 180).';
    }
    if (formData.startLat === formData.endLat && formData.startLng === formData.endLng) {
      errs.endLat = 'Điểm xuất phát và kết thúc không được trùng nhau.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Vui lòng kiểm tra lại tọa độ GPS tại Bước 3!', 'error');
      return false;
    }
    return true;
  };

  const validateStep4 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.coverImage.trim()) {
      errs.coverImage = 'Vui lòng tải ảnh từ thiết bị hoặc nhập link ảnh bìa thực địa.';
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errs.description = 'Mô tả tổng quan cần ít nhất 10 ký tự.';
    }
    if (!formData.transportationInfo.trim() || formData.transportationInfo.trim().length < 5) {
      errs.transportationInfo = 'Hướng dẫn di chuyển cần ít nhất 5 ký tự.';
    }
    if (!formData.rescueContact.phone.trim() || formData.rescueContact.phone.trim().length < 3) {
      errs.rescuePhone = 'Vui lòng nhập số hotline cứu hộ khẩn cấp thực tế.';
    }
    if (formData.permitRequired && !formData.permitInfo.trim()) {
      errs.permitInfo = 'Vui lòng nhập nơi cấp phép hoặc lệ phí.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Vui lòng điền đủ ảnh, mô tả & hotline cứu hộ tại Bước 4!', 'error');
      return false;
    }
    return true;
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) return;
    setLoading(true);
    try {
      const editingStr = localStorage.getItem('trekmap_editing_contribution');
      let contribId = `contrib-${Date.now()}`;
      if (editingStr) {
        try {
          contribId = JSON.parse(editingStr).id || contribId;
        } catch (e) {
          console.error(e);
        }
      }

      let finalCoverImage = formData.coverImage;
      if (finalCoverImage && !finalCoverImage.includes('res.cloudinary.com')) {
        try {
          const cloudinaryUrl = await uploadImageToCloudinary(finalCoverImage, `trail_cover_${Date.now()}`, 'trails');
          if (cloudinaryUrl) finalCoverImage = cloudinaryUrl;
        } catch (imgErr) {
          console.warn('Upload warning:', imgErr);
        }
      }

      const finalGpxTrack: [number, number][] =
        gpxTrack.length > 0
          ? gpxTrack
          : [
              [formData.startLat, formData.startLng],
              [formData.startLat + 0.005, formData.startLng + 0.005],
              [formData.endLat, formData.endLng],
            ];

      const payload = {
        ...formData,
        id: contribId,
        coverImage: finalCoverImage,
        altNames: formData.altNames.split(',').map((s) => s.trim()).filter(Boolean),
        gpxTrack: finalGpxTrack,
        authorName: currentUser?.fullName || currentUser?.name || 'Trekker Đóng Góp',
        authorAvatar: currentUser?.avatarUrl || currentUser?.avatar || '',
        authorEmail: currentUser?.email || '',
        userId: (currentUser as any)?._id || currentUser?.id || '',
      };

      await submitTrailContribution(payload);
      setLoading(false);

      const toastMsg = isEditing
        ? 'Cập nhật bài đóng góp vào Database thành công!'
        : 'Đã lưu bài đóng góp vào Database thành công! Đã gửi thông báo tới Ban Quản Trị duyệt.';
      onShowToast?.(toastMsg, 'success');
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      onShowToast?.(err.message || 'Không thể lưu bài đóng góp vào Database, vui lòng thử lại.', 'error');
    }
  };

  return (
    <div style={{ maxWidth: 1240, margin: '14px auto 48px auto', padding: '0 20px', boxSizing: 'border-box' }}>
      {/* Top Action & Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn btn-outline"
            onClick={onBack}
            style={{ padding: '7px 16px', fontSize: '0.84rem', borderRadius: 10, height: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} /> Hủy & Quay lại
          </button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-main)', margin: 0 }}>
            {isEditing ? 'Chỉnh Sửa Thông Tin Bài Đóng Góp' : 'Đóng Góp Cung Đường Trekking Mới Cho Cộng Đồng'}
          </h2>
        </div>
      </div>

      {/* Balanced 5-Column Stepper Progress Bar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: 20,
          borderRadius: 16,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, alignItems: 'center' }}>
          {[
            { stepNum: 1, title: 'Vị Trí & Tên' },
            { stepNum: 2, title: 'Thông Số & Mùa' },
            { stepNum: 3, title: 'Bản Đồ GPS' },
            { stepNum: 4, title: 'Tiện Ích & Cứu Hộ' },
            { stepNum: 5, title: 'Xem Trước & Gửi' },
          ].map(({ stepNum, title }) => {
            const isActive = step === stepNum;
            const isDone = step > stepNum;

            return (
              <div
                key={stepNum}
                onClick={() => {
                  if (stepNum < step) setStep(stepNum);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '10px 8px',
                  borderRadius: 12,
                  background: isActive
                    ? 'rgba(16, 185, 129, 0.14)'
                    : isDone
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'transparent',
                  border: isActive
                    ? '1.5px solid var(--color-primary)'
                    : isDone
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : '1px solid var(--color-border)',
                  cursor: stepNum < step ? 'pointer' : 'default',
                  transition: 'all 0.25s ease',
                  boxShadow: isActive ? '0 0 14px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: isDone
                      ? 'var(--color-primary)'
                      : isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-bg-main)',
                    color: isDone || isActive ? '#ffffff' : 'var(--color-text-dim)',
                    border: isActive || isDone ? 'none' : '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    flexShrink: 0,
                  }}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: isActive ? 'var(--color-primary)' : isDone ? 'var(--color-text-main)' : 'var(--color-text-dim)',
                    fontWeight: isActive ? 800 : isDone ? 700 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sliding Steps Container */}
      <div key={step} className="tab-content-slide">
        {/* ================= STEP 1: SPACIOUS 2-COLUMN VIEWPORT LAYOUT ================= */}
        {step === 1 && (
        <div className="card" style={{ padding: '26px 32px', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <IconCompass size={22} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
              Bước 1: Tên Cung Đường & Phân Cấp Hành Chính (100% Thực Địa)
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column: Names & Base */}
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Tên cung đường chính *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '10px 14px', fontSize: '0.9rem', borderColor: errors.name ? '#ef4444' : undefined }}
                  placeholder="Ví dụ: Chinh Phục Đỉnh Pu Ta Leng 3049m"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
                {errors.name && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: 4, fontWeight: 600 }}>{errors.name}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Tên gọi khác / Tên đỉnh (phân tách bởi dấu phẩy)</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '10px 14px', fontSize: '0.9rem' }}
                  placeholder="Ví dụ: Pu Ta Leng Peak, Nóc Nhà Thứ 3 Đông Dương..."
                  value={formData.altNames}
                  onChange={(e) => handleChange('altNames', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Thôn / Bản / Cửa Rừng (Căn cứ xuất phát) *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '10px 14px', fontSize: '0.9rem', borderColor: errors.hamlet ? '#ef4444' : undefined }}
                  placeholder="Ví dụ: Bản Phô Hồ Thầu, Trạm Tôn 1.900m, Bản Sàng Ma Fo..."
                  value={formData.hamlet || ''}
                  onChange={(e) => handleChange('hamlet', e.target.value)}
                />
                {errors.hamlet && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: 4, fontWeight: 600 }}>{errors.hamlet}</div>}
              </div>
            </div>

            {/* Right Column: Administrative Location */}
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Vùng miền *</label>
                <select className="form-select" style={{ padding: '10px 14px', fontSize: '0.9rem' }} value={formData.region} onChange={(e) => handleRegionChange(e.target.value as Region)}>
                  <option value="Miền Bắc">Miền Bắc</option>
                  <option value="Miền Trung">Miền Trung</option>
                  <option value="Miền Nam">Miền Nam</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Thành phố / Tỉnh *</label>
                <select className="form-select" style={{ padding: '10px 14px', fontSize: '0.9rem' }} value={formData.province} onChange={(e) => handleProvinceChange(e.target.value)}>
                  {(VIETNAM_ADMINISTRATIVE_DATA[formData.region] || []).map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Phường / Xã / Huyện *</label>
                <select
                  className="form-select"
                  style={{ padding: '10px 14px', fontSize: '0.9rem' }}
                  value={isCustomWard ? 'CUSTOM_WARD_OPTION' : formData.district}
                  onChange={(e) => handleWardSelect(e.target.value)}
                >
                  {((VIETNAM_ADMINISTRATIVE_DATA[formData.region] || []).find((p) => p.name === formData.province)?.wards || []).map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                  <option value="CUSTOM_WARD_OPTION">+ Thêm Phường / Xã khác...</option>
                </select>
              </div>

              {isCustomWard && (
                <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    placeholder="Nhập tên Phường, Xã cụ thể..."
                    value={customWardText}
                    onChange={(e) => {
                      setCustomWardText(e.target.value);
                      setFormData((prev) => ({ ...prev, district: e.target.value }));
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              style={{ padding: '11px 32px', fontSize: '0.95rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12 }}
            >
              Tiếp theo: Thông số kỹ thuật & Mùa leo <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: METRICS & 12-MONTH RADAR PICKER ================= */}
      {step === 2 && (
        <div className="card" style={{ padding: '26px 32px', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <IconMountain size={22} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
              Bước 2: Thông Số Kỹ Thuật & Lịch Mùa Trekking 12 Tháng
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
            {/* Left Column: 3 Numeric Metrics & Duration */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Cự ly (km) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    style={{ padding: '9px 12px', fontSize: '0.88rem', borderColor: errors.distanceKm ? '#ef4444' : undefined }}
                    value={formData.distanceKm}
                    onChange={(e) => handleChange('distanceKm', Number(e.target.value))}
                  />
                  {errors.distanceKm && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.distanceKm}</div>}
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Độ dốc (+m) *</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ padding: '9px 12px', fontSize: '0.88rem', borderColor: errors.elevationGainM ? '#ef4444' : undefined }}
                    value={formData.elevationGainM}
                    onChange={(e) => handleChange('elevationGainM', Number(e.target.value))}
                  />
                  {errors.elevationGainM && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.elevationGainM}</div>}
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Cao độ đỉnh (m) *</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ padding: '9px 12px', fontSize: '0.88rem', borderColor: errors.maxAltitudeM ? '#ef4444' : undefined }}
                    value={formData.maxAltitudeM}
                    onChange={(e) => handleChange('maxAltitudeM', Number(e.target.value))}
                  />
                  {errors.maxAltitudeM && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.maxAltitudeM}</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Thời gian đi *</label>
                  <select
                    className="form-select"
                    style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                    value={formData.durationHoursNote}
                    onChange={(e) => {
                      const val = e.target.value;
                      let days = 1;
                      if (val.includes('2 ngày')) days = 2;
                      if (val.includes('3 ngày')) days = 3;
                      if (val.includes('4 ngày')) days = 4;
                      setFormData((prev) => ({ ...prev, durationHoursNote: val, durationDays: days }));
                    }}
                  >
                    <option value="1 ngày">1 ngày (Trong ngày)</option>
                    <option value="2 ngày 1 đêm">2 ngày 1 đêm</option>
                    <option value="3 ngày 2 đêm">3 ngày 2 đêm</option>
                    <option value="4 ngày 3 đêm">4 ngày 3 đêm</option>
                    <option value="Nửa ngày">Nửa ngày (4-6 tiếng)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Độ khó (1 - 5) *</label>
                  <select className="form-select" style={{ padding: '9px 12px', fontSize: '0.88rem' }} value={formData.difficultyLevel} onChange={(e) => handleChange('difficultyLevel', Number(e.target.value))}>
                    <option value={1}>1/5 - Rất dễ (Người mới)</option>
                    <option value={2}>2/5 - Dễ (Gia đình)</option>
                    <option value={3}>3/5 - Trung bình (Thể lực tốt)</option>
                    <option value={4}>4/5 - Thử thách (Dốc đứng)</option>
                    <option value={5}>5/5 - Khắc nghiệt (Chuyên nghiệp)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Ghi chú địa hình & độ khó</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                  placeholder="Ví dụ: Vách đá dốc, rừng trúc trơn trượt, qua lán 2800m..."
                  value={formData.difficultyNote}
                  onChange={(e) => handleChange('difficultyNote', e.target.value)}
                />
              </div>
            </div>

            {/* Right Column: 12-Month Interactive Season Picker */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCalendar size={16} color="var(--color-primary)" /> Lịch 12 Tháng Trekking *
                </label>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block', boxShadow: '0 0 6px var(--color-primary)' }} />
                    Mùa lý tưởng
                  </span>
                  <span style={{ color: 'var(--color-error)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-error)', display: 'inline-block', boxShadow: '0 0 6px var(--color-error)' }} />
                    Tránh mưa bão
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: 12 }}>
                Nhấp vào từng tháng để chuyển đổi: <strong>Lý tưởng (Xanh)</strong> $\rightarrow$ <strong>Nên tránh (Đỏ)</strong> $\rightarrow$ <strong>Bình thường</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const isBest = formData.bestMonths.includes(m);
                  const isAvoid = formData.avoidMonths.includes(m);

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleToggleMonth(m)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 10,
                        border: isBest
                          ? '1.5px solid var(--color-primary)'
                          : isAvoid
                          ? '1.5px solid var(--color-error)'
                          : '1px solid var(--color-border)',
                        background: isBest
                          ? 'rgba(16, 185, 129, 0.2)'
                          : isAvoid
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'var(--color-bg-card)',
                        color: isBest ? 'var(--color-primary)' : isAvoid ? 'var(--color-error)' : 'var(--color-text-dim)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>T{m}</span>
                      <span style={{ fontSize: '0.68rem' }}>{isBest ? '✓' : isAvoid ? '✕' : '-'}</span>
                    </button>
                  );
                })}
              </div>
              {errors.bestMonths && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: 6, fontWeight: 600 }}>{errors.bestMonths}</div>}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ padding: '10px 24px', fontSize: '0.9rem', borderRadius: 10 }}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (validateStep2()) setStep(3);
              }}
              style={{ padding: '10px 28px', fontSize: '0.9rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 10 }}
            >
              Tiếp theo: Bản đồ & Tọa độ GPS <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: GPS MAP & GPX TRACK ================= */}
      {step === 3 && (
        <div className="card" style={{ padding: '26px 32px', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconMapPin size={22} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
                Bước 3: Đánh Dấu Tọa Độ GPS & Tuyến Đường Tracklog
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setPinMode('start')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: pinMode === 'start' ? 'var(--color-primary)' : 'var(--color-bg-main)',
                  color: pinMode === 'start' ? '#ffffff' : 'var(--color-text-dim)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                1. Ghim Xuất Phát
              </button>
              <button
                type="button"
                onClick={() => setPinMode('end')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: pinMode === 'end' ? '#ef4444' : 'var(--color-bg-main)',
                  color: pinMode === 'end' ? '#ffffff' : 'var(--color-text-dim)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                2. Ghim Đích / Đỉnh
              </button>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 12px', height: 32 }}
                value={mapTileType}
                onChange={(e: any) => setMapTileType(e.target.value)}
              >
                <option value="satellite">Vệ Tinh (Esri World)</option>
                <option value="terrain">Địa Hình (Topo)</option>
                <option value="osm">Bản Đồ Phố</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 20, alignItems: 'start' }}>
            {/* Map Canvas */}
            <div>
              <div style={{ height: 280, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 12, position: 'relative' }}>
                <MapContainer
                  center={PROVINCE_COORDINATES[formData.province] || [formData.startLat, formData.startLng]}
                  zoom={11}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url={
                      mapTileType === 'satellite'
                        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        : mapTileType === 'terrain'
                        ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
                        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    }
                    attribution="Esri, OSM"
                  />
                  <MapClickListener
                    onSelectCoords={(lat, lng) => {
                      if (pinMode === 'start') {
                        setFormData((prev) => ({ ...prev, startLat: lat, startLng: lng }));
                      } else {
                        setFormData((prev) => ({ ...prev, endLat: lat, endLng: lng }));
                      }
                    }}
                  />
                  <Marker position={[formData.startLat, formData.startLng]} icon={greenPinIcon}>
                    <Popup>Xuất phát: {formData.startLat}, {formData.startLng}</Popup>
                  </Marker>
                  <Marker position={[formData.endLat, formData.endLng]} icon={redPinIcon}>
                    <Popup>Đích / Đỉnh: {formData.endLat}, {formData.endLng}</Popup>
                  </Marker>
                  <Polyline
                    positions={
                      gpxTrack.length > 0
                        ? gpxTrack
                        : [
                            [formData.startLat, formData.startLng],
                            [formData.endLat, formData.endLng],
                          ]
                    }
                    color="#10b981"
                    weight={4}
                  />
                </MapContainer>
              </div>

              {/* GPX Upload Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: '8px 14px', borderRadius: 10 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 700 }}>Tệp GPX Tuyến Đường:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label htmlFor="gpx-file-upload-input" className="btn btn-outline" style={{ padding: '5px 14px', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 8, height: 28, display: 'inline-flex', alignItems: 'center' }}>
                    Tải tệp .gpx
                  </label>
                  <span style={{ fontSize: '0.78rem', color: gpxFileName ? 'var(--color-primary)' : 'var(--color-text-dim)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gpxFileName || 'Chưa chọn tệp'}
                  </span>
                  <input id="gpx-file-upload-input" type="file" accept=".gpx" onChange={handleGpxUpload} style={{ display: 'none' }} />
                </div>
              </div>
            </div>

            {/* Coordinates Fields & Tips */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 6 }}>1. Tọa độ Xuất Phát</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vĩ độ (Lat)</label>
                      <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem' }} value={formData.startLat} onChange={(e) => handleChange('startLat', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Kinh độ (Lng)</label>
                      <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem' }} value={formData.startLng} onChange={(e) => handleChange('startLng', Number(e.target.value))} />
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-error)', marginBottom: 6 }}>2. Tọa độ Đích / Đỉnh</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vĩ độ (Lat)</label>
                      <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem' }} value={formData.endLat} onChange={(e) => handleChange('endLat', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Kinh độ (Lng)</label>
                      <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem' }} value={formData.endLng} onChange={(e) => handleChange('endLng', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14, fontSize: '0.78rem', color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconLightbulb size={16} color="var(--color-sun)" /> Hướng Dẫn Tọa Độ Thực Địa
                </div>
                <div>• Nhấp trực tiếp vào bản đồ vệ tinh để cập nhật tọa độ chính xác.</div>
                <div>• Nếu có tệp <code>.gpx</code>, hệ thống sẽ tự động vẽ toàn bộ tracklog đường mòn và đọc cao độ thực tế.</div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ padding: '10px 24px', fontSize: '0.9rem', borderRadius: 10 }}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (validateStep3()) setStep(4);
              }}
              style={{ padding: '10px 28px', fontSize: '0.9rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 10 }}
            >
              Tiếp theo: Tiện ích & Cứu hộ <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: FACILITIES, RESCUE, PERMIT & MEDIA ================= */}
      {step === 4 && (
        <div className="card" style={{ padding: '26px 32px', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <IconShieldCheck size={22} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
              Bước 4: Tiện Ích, Giấy Phép, Hotline Cứu Hộ & Ảnh Thực Địa
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column: Cover Image & Description */}
            <div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>Ảnh bìa thực địa *</label>
                  <label htmlFor="cover-file-input" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.76rem', height: 26, cursor: 'pointer', borderRadius: 8 }}>
                    {uploadingImage ? 'Đang tải...' : 'Tải ảnh từ máy'}
                  </label>
                  <input id="cover-file-input" type="file" accept="image/*" disabled={uploadingImage} onChange={handleCoverImageUpload} style={{ display: 'none' }} />
                </div>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: errors.coverImage ? '#ef4444' : undefined }}
                  placeholder="https://images.unsplash.com/... hoặc link ảnh Cloudinary"
                  value={formData.coverImage}
                  onChange={(e) => handleChange('coverImage', e.target.value)}
                />
                {errors.coverImage && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: 2 }}>{errors.coverImage}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>Mô tả tổng quan cung đường *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: errors.description ? '#ef4444' : undefined }}
                  placeholder="Mô tả về đặc trưng cảnh quan, thảm thực vật, mốc thời gian..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                />
                {errors.description && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: 2 }}>{errors.description}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>Hướng dẫn di chuyển đến chân núi *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: errors.transportationInfo ? '#ef4444' : undefined }}
                  placeholder="Lộ trình xe khách giường nằm, xe ôm vào bản, điểm gửi xe..."
                  value={formData.transportationInfo}
                  onChange={(e) => handleChange('transportationInfo', e.target.value)}
                />
                {errors.transportationInfo && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: 2 }}>{errors.transportationInfo}</div>}
              </div>
            </div>

            {/* Right Column: Rescue Hotline & Facilities Checkboxes */}
            <div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-sun)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconAlertTriangle size={16} color="var(--color-sun)" /> Cứu Hộ & Kiểm Lâm Địa Bàn (Thực Tế) *
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Đơn vị phụ trách / VQG</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: '0.82rem' }}
                      value={formData.rescueContact.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rescueContact: { ...prev.rescueContact, name: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Số hotline cứu hộ *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: '0.82rem', borderColor: errors.rescuePhone ? '#ef4444' : undefined }}
                      placeholder="114 / 02143.871.228"
                      value={formData.rescueContact.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rescueContact: { ...prev.rescueContact, phone: e.target.value } }))}
                    />
                    {errors.rescuePhone && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.rescuePhone}</div>}
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Trạm kiểm lâm cửa rừng</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '7px 10px', fontSize: '0.82rem' }}
                    value={formData.rescueContact.rangerContact}
                    onChange={(e) => setFormData((prev) => ({ ...prev, rescueContact: { ...prev.rescueContact, rangerContact: e.target.value } }))}
                  />
                </div>
              </div>

              {/* Facilities Checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={formData.permitRequired} onChange={(e) => handleChange('permitRequired', e.target.checked)} />
                  <span>Cần giấy phép VQG</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={formData.hasCampsite} onChange={(e) => handleChange('hasCampsite', e.target.checked)} />
                  <span>Có bãi cắm trại</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={formData.hasWaterSource} onChange={(e) => handleChange('hasWaterSource', e.target.checked)} />
                  <span>Có nguồn nước</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={formData.kidFriendly} onChange={(e) => handleChange('kidFriendly', e.target.checked)} />
                  <span>Phù hợp trẻ em</span>
                </label>
              </div>

              {formData.permitRequired && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderColor: errors.permitInfo ? '#ef4444' : undefined }}
                    placeholder="Nhập tên nơi cấp phép (BQL VQG Hoàng Liên, vé 60k...)"
                    value={formData.permitInfo}
                    onChange={(e) => handleChange('permitInfo', e.target.value)}
                  />
                  {errors.permitInfo && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.permitInfo}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ padding: '10px 24px', fontSize: '0.9rem', borderRadius: 10 }}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (validateStep4()) setStep(5);
              }}
              style={{ padding: '10px 28px', fontSize: '0.9rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 10 }}
            >
              Xem trước bài đóng góp <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 5: LIVE HUD PREVIEW & SUBMIT ================= */}
      {step === 5 && (
        <div className="card" style={{ padding: '26px 32px', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={currentUser?.avatarUrl || currentUser?.avatar || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg'}
                alt="Avatar"
                style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid var(--color-primary)' }}
              />
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                {currentUser?.fullName || currentUser?.name || 'Trekker Đóng Góp'}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>• +50 điểm uy tín khi Ban Quản Trị duyệt</span>
            </div>
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 14px', borderRadius: 16, fontSize: '0.78rem', fontWeight: 800 }}>
              ⏳ Trạng thái: Chờ Ban Quản Trị Duyệt
            </span>
          </div>

          {/* 2-Column Live HUD Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 18, marginBottom: 20 }}>
            {/* Left Column: Image & Details */}
            <div>
              {formData.coverImage && (
                <div style={{ height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 12, position: 'relative' }}>
                  <img src={formData.coverImage} alt={formData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 8, left: 10, background: 'var(--color-primary)', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6 }}>
                    {formData.region} • {formData.province}
                  </div>
                </div>
              )}
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--color-text-main)', marginBottom: 4 }}>{formData.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 8 }}>
                Xuất phát: <strong>{formData.hamlet}</strong>, {formData.district}, {formData.province}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', lineHeight: 1.45, maxHeight: 54, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formData.description}
              </div>
            </div>

            {/* Right Column: 4 Metrics & Season / Rescue Info */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Cự ly</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-sky)' }}>{formData.distanceKm}km</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Cao độ</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-sun)' }}>{formData.maxAltitudeM}m</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Độ dốc</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-earth)' }}>+{formData.elevationGainM}m</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Độ khó</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-primary)' }}>{formData.difficultyLevel}/5</div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Mùa leo núi lý tưởng:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {formData.bestMonths.map((m) => (
                  <span key={m} style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                    Tháng {m}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                Hotline cứu hộ: <strong>{formData.rescueContact.phone || '114'}</strong> ({formData.rescueContact.name})
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
            <button className="btn btn-secondary" onClick={() => setStep(4)} style={{ padding: '11px 24px', fontSize: '0.9rem', borderRadius: 12 }}>
              <ArrowLeft size={16} /> Sửa thông tin
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{ flex: 1, padding: '11px 32px', fontSize: '0.95rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 }}
            >
              {loading ? (
                <span>Đang lưu vào Database...</span>
              ) : (
                <>
                  <IconSend size={16} />
                  {isEditing ? 'Cập Nhật & Lưu Vào Database' : 'Xác Nhận & Lưu Vào Database (Gửi BQT Duyệt)'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
