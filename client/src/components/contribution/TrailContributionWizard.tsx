import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { submitTrailContribution, uploadImageToCloudinary } from '../../services/api.js';
import type { Region } from '../../types.js';
import { ArrowLeft, ArrowRight } from 'lucide-react';

// Custom Green Marker Icon for Start Point
const greenPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom Red Marker Icon for End Point / Summit
const redPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Helper component to capture map clicks and update coordinates
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

// 34 Updated Merged Provinces & Cities of Vietnam (Post Administrative Reform)
const VIETNAM_ADMINISTRATIVE_DATA: Record<string, ProvinceData[]> = {
  'Miền Bắc': [
    { name: 'Thành phố Hà Nội', wards: ['Phường Ba Đình', 'Phường Hoàn Kiếm', 'Xã Ba Vì', 'Xã Hương Sơn (Chùa Hương)', 'Xã Mỹ Đức', 'Xã Quốc Oai', 'Xã Sóc Sơn', 'Xã Thạch Thất', 'Phường Sơn Tây'] },
    { name: 'Tỉnh Lào Cai', wards: ['Phường Sa Pa', 'Xã Y Tý', 'Xã Bát Xát', 'Xã Mường Hum', 'Xã Trịnh Tường', 'Xã Tả Van', 'Xã Bản Hồ', 'Xã Ngũ Chỉ Sơn', 'Xã Tả Phìn', 'Xã San Sả Hồ'] },
    { name: 'Tỉnh Yên Bái', wards: ['Phường Nghĩa Lộ', 'Xã Trạm Tấu', 'Xã Mù Cang Chải', 'Xã Xà Hồ', 'Xã Túc Đán', 'Xã Tú Lệ', 'Xã Púng Luông', 'Xã La Pán Tẩn', 'Xã Dế Chố Thù'] },
    { name: 'Tỉnh Hà Giang', wards: ['Phường Hà Giang', 'Xã Đồng Văn', 'Xã Mèo Vạc', 'Xã Lũng Cú', 'Xã Pả Vỉ', 'Xã Thông Nguyên (Hoàng Su Phì)', 'Xã Quản Bạ', 'Xã Yên Minh', 'Xã Vị Xuyên'] },
    { name: 'Tỉnh Lai Châu', wards: ['Phường Lai Châu', 'Xã Tam Đường', 'Xã Tả Liên', 'Xã Sơn Bình', 'Xã Hồ Thầu', 'Xã Khun Há', 'Xã Phong Thổ', 'Xã Sìn Hồ', 'Xã Mường Tè', 'Xã Nậm Nhùn'] },
    { name: 'Tỉnh Sơn La', wards: ['Phường Sơn La', 'Xã Bắc Yên', 'Xã Tà Xùa', 'Xã Lóng Luông', 'Phường Mộc Châu', 'Xã Chiềng Đi', 'Xã Vân Hồ', 'Xã Mai Sơn', 'Xã Quỳnh Nhai'] },
    { name: 'Tỉnh Hòa Bình', wards: ['Phường Hòa Bình', 'Xã Mai Châu', 'Xã Hang Kia', 'Xã Pà Cò', 'Xã Cao Phong', 'Xã Thung Nai', 'Xã Lương Sơn', 'Xã Tân Lạc', 'Xã Đà Bắc'] },
    { name: 'Tỉnh Cao Bằng', wards: ['Phường Cao Bằng', 'Xã Trùng Khánh', 'Xã Đàm Thủy (Bản Giốc)', 'Xã Hà Quảng', 'Xã Bảo Lạc', 'Xã Nguyên Bình', 'Xã Quảng Hòa'] },
    { name: 'Tỉnh Lạng Sơn', wards: ['Phường Lạng Sơn', 'Xã Mẫu Sơn', 'Xã Hữu Lũng', 'Xã Chi Lăng', 'Xã Lộc Bình', 'Xã Tràng Định'] },
    { name: 'Tỉnh Quảng Ninh', wards: ['Thành phố Hạ Long', 'Phường Yên Tử (Uông Bí)', 'Xã Bình Liêu', 'Xã Cô Tô', 'Xã Vân Đồn', 'Xã Ba Chẽ', 'Xã Tiên Yên'] },
    { name: 'Tỉnh Tuyên Quang', wards: ['Phường Tuyên Quang', 'Xã Na Hang', 'Xã Lâm Bình', 'Xã Tân Trào', 'Xã Yên Sơn', 'Xã Chiêm Hóa'] },
    { name: 'Tỉnh Phú Thọ', wards: ['Thành phố Việt Trì', 'Xã Xuân Sơn (Vườn Quốc Gia)', 'Xã Thanh Thủy', 'Phường Thị xã Phú Thọ', 'Xã Đoan Hùng'] },
    { name: 'Tỉnh Vĩnh Phúc', wards: ['Thành phố Vĩnh Yên', 'Phường Tam Đảo', 'Thành phố Phúc Yên', 'Xã Lập Thạch', 'Xã Sông Lô'] },
    { name: 'Tỉnh Bắc Giang', wards: ['Thành phố Bắc Giang', 'Xã Tây Yên Tử', 'Xã Lục Nam', 'Xã Lục Ngạn', 'Xã Yên Dũng', 'Xã Sơn Động'] },
    { name: 'Tỉnh Bắc Ninh', wards: ['Thành phố Bắc Ninh', 'Phường Từ Sơn', 'Xã Tiên Du', 'Xã Yên Phong', 'Xã Thuận Thành'] },
    { name: 'Tỉnh Thái Nguyên', wards: ['Thành phố Thái Nguyên', 'Phường Sông Công', 'Xã Võ Nhai', 'Xã Định Hóa', 'Xã Đại Từ (Núi Cốc)'] },
    { name: 'Tỉnh Bắc Kạn', wards: ['Phường Bắc Kạn', 'Xã Ba Bể', 'Xã Chợ Đồn', 'Xã Nân Pắc', 'Xã Bạc Thông'] },
  ],
  'Miền Trung': [
    { name: 'Thành phố Đà Nẵng', wards: ['Phường Sơn Trà', 'Phường Thọ Quang', 'Phường Phước Mỹ', 'Phường An Hải', 'Phường Hải Châu', 'Phường Thạch Thang', 'Phường Thanh Khê', 'Phường Mỹ An', 'Phường Khuê Mỹ', 'Phường Ngũ Hành Sơn', 'Phường Liên Chiểu', 'Phường Hòa Khánh', 'Phường Cẩm Lệ', 'Xã Hòa Vang', 'Xã Hòa Bắc (Núi Chúa)', 'Xã Hòa Ninh (Bà Nà)', 'Xã Hòa Phú'] },
    { name: 'Thành phố Huế', wards: ['Phường Huế', 'Phường Thuận Thành', 'Phường Vĩnh Ninh', 'Phường Phú Hội', 'Xã A Lưới', 'Xã Nam Đông', 'Xã Bạch Mã (Phú Lộc)', 'Xã Phong Điền', 'Xã Hương Thủy'] },
    { name: 'Tỉnh Quảng Bình', wards: ['Thành phố Đồng Hới', 'Xã Phong Nha - Kẻ Bàng', 'Xã Sơn Trạch', 'Xã Tân Hóa', 'Xã Bố Trạch', 'Xã Minh Hóa', 'Xã Tuyên Hóa', 'Xã Lệ Thủy'] },
    { name: 'Tỉnh Quảng Nam', wards: ['Thành phố Hội An', 'Thành phố Tam Kỳ', 'Xã Tây Giang', 'Xã Nam Giang', 'Xã Phước Sơn', 'Xã Ngọc Linh', 'Xã Bắc Trà My', 'Xã Nam Trà My'] },
    { name: 'Thành phố Đà Lạt (Lâm Đồng)', wards: ['Phường Đà Lạt', 'Phường Xuân Thọ', 'Phường Tuyền Lâm', 'Phường Bảo Lộc', 'Xã Lạc Dương (Lang Biang)', 'Xã Bidoup', 'Xã Đạ Nhim', 'Xã Tà Năng', 'Xã Phan Dũng', 'Xã Đơn Dương'] },
    { name: 'Tỉnh Đắk Lắk', wards: ['Thành phố Buôn Ma Thuột', 'Xã Buôn Đôn', 'Xã Krông Bông (Chư Yang Sin)', 'Xã Lắk', 'Xã M\'Đrắk', 'Xã Krông Năng'] },
    { name: 'Tỉnh Khánh Hòa', wards: ['Thành phố Nha Trang', 'Thành phố Cam Ranh', 'Xã Cam Lâm', 'Xã Hòn Bà (Khánh Vĩnh)', 'Xã Khánh Sơn', 'Xã Vạn Ninh', 'Xã Ninh Hòa'] },
    { name: 'Tỉnh Ninh Thuận', wards: ['Thành phố Phan Rang - Tháp Chàm', 'Xã Phước Bình', 'Xã Vĩnh Hy (Núi Chúa)', 'Xã Bác Ái', 'Xã Ninh Sơn', 'Xã Thuận Bắc'] },
    { name: 'Tỉnh Bình Thuận', wards: ['Thành phố Phan Thiết', 'Xã Phan Dũng', 'Xã Tuy Phong', 'Xã Tánh Linh (Núi Ông)', 'Xã Hàm Thuận Bắc', 'Xã Hàm Thuận Nam'] },
    { name: 'Tỉnh Gia Lai', wards: ['Thành phố Pleiku', 'Xã Chư Đăng Ya', 'Xã Kbang (Kon Ka Kinh)', 'Xã Ia Grai', 'Xã Kông Chro', 'Xã Mang Yang'] },
    { name: 'Tỉnh Kon Tum', wards: ['Thành phố Kon Tum', 'Xã Măng Đen (Kon Plông)', 'Xã Đắk Glei', 'Xã Tu Mơ Rông', 'Xã Sa Thầy'] },
  ],
  'Miền Nam': [
    { name: 'Thành phố Hồ Chí Minh', wards: ['Phường TP. Thủ Đức', 'Xã Cần Giờ', 'Xã Củ Chi', 'Xã Bình Chánh', 'Phường Quận 1', 'Phường Quận 7'] },
    { name: 'Tỉnh Bà Rịa - Vũng Tàu', wards: ['Thành phố Vũng Tàu', 'Thành phố Bà Rịa', 'Xã Núi Dinh', 'Xã Xuyên Mộc (Bình Châu)', 'Xã Đất Đỏ', 'Xã Côn Đảo'] },
    { name: 'Tỉnh Đồng Nai', wards: ['Thành phố Biên Hòa', 'Xã Nam Cát Tiên (Tân Phú)', 'Xã Chứa Chan (Xuân Lộc)', 'Xã Định Quán', 'Xã Vĩnh Cửu'] },
    { name: 'Tỉnh Tây Ninh', wards: ['Thành phố Tây Ninh', 'Phường Ninh Sơn (Núi Bà Đen)', 'Xã Tân Biên', 'Xã Dương Minh Châu', 'Xã Châu Thành'] },
    { name: 'Tỉnh An Giang', wards: ['Thành phố Long Xuyên', 'Thành phố Châu Đốc', 'Xã An Hảo (Núi Cấm)', 'Xã Tri Tôn', 'Xã Tịnh Biên'] },
    { name: 'Tỉnh Kiên Giang', wards: ['Thành phố Phú Quốc', 'Thành phố Rạch Giá', 'Thành phố Hà Tiên', 'Xã Nam Du', 'Xã Kiên Lương'] },
    { name: 'Tỉnh Bình Phước', wards: ['Thành phố Đồng Xoài', 'Xã Bù Gia Mập', 'Xã Bù Đăng', 'Xã Lộc Ninh', 'Xã Hớn Quản'] },
  ],
};

import type { UserProfile } from '../../types.js';

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

  // Form State
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
    difficultyNote: 'Cần thể lực tốt',
    description: '',
    transportationInfo: '',
    coverImage: '',
    permitRequired: false,
    permitInfo: '',
    hasCampsite: false,
    hasWaterSource: false,
    kidFriendly: false,
    startLat: 22.3364,
    startLng: 103.8438,
    endLat: 22.3512,
    endLng: 103.8640,
  });

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
    'Tỉnh Quảng Nam': [15.5670, 108.0000],
    'Thành phố Đà Lạt (Lâm Đồng)': [11.9404, 108.4583],
    'Tỉnh Đắk Lắk': [12.6667, 108.0500],
    'Tỉnh Khánh Hòa': [12.2451, 109.1943],
    'Thành phố Hà Nội': [21.0285, 105.8542],
    'Thành phố Hồ Chí Minh': [10.8231, 106.6297],
    'Tỉnh Bà Rịa - Vũng Tàu': [10.3460, 107.0843],
    'Tỉnh Tây Ninh': [11.3108, 106.0984],
    'Tỉnh An Giang': [10.3759, 105.4185],
    'Tỉnh Kiên Giang': [10.0125, 105.0809],
  };

  const [gpxFileName, setGpxFileName] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

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
      } catch (err) {
        console.error('Upload image error:', err);
        alert('Không thể tải ảnh lên Cloudinary, vui lòng thử lại.');
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
            if (onShowToast) {
              onShowToast(`Đã trích xuất ${points.length} điểm track GPS từ tệp GPX thành công!`, 'success');
            }
          }
        }
      } catch (err) {
        console.error('GPX parse error:', err);
      }
    };
    reader.readAsText(file);
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const editingStr = localStorage.getItem('trekmap_editing_contribution');
    if (editingStr) {
      try {
        const editingItem = JSON.parse(editingStr);
        setFormData((prev) => ({
          ...prev,
          ...editingItem,
        }));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) {
      errs.name = 'Vui lòng nhập tên cung đường chính.';
    }
    if (!formData.hamlet.trim()) {
      errs.hamlet = 'Vui lòng nhập điểm căn cứ xuất phát (Thôn/Bản/Trạm cửa rừng).';
    }
    if (!formData.distanceKm || formData.distanceKm <= 0) {
      errs.distanceKm = 'Độ dài cung đường phải lớn hơn 0 km.';
    }
    if (formData.elevationGainM === undefined || formData.elevationGainM < 0) {
      errs.elevationGainM = 'Độ cao nâng không được là số âm.';
    }
    if (!formData.maxAltitudeM || formData.maxAltitudeM <= 0) {
      errs.maxAltitudeM = 'Cao độ đỉnh max phải lớn hơn 0 m.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (onShowToast) {
        onShowToast('Vui lòng hoàn thành đầy đủ các thông tin bắt buộc tại Bước 1!', 'error');
      }
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (isNaN(formData.startLat) || formData.startLat < -90 || formData.startLat > 90) {
      errs.startLat = 'Vĩ độ xuất phát không hợp lệ.';
    }
    if (isNaN(formData.startLng) || formData.startLng < -180 || formData.startLng > 180) {
      errs.startLng = 'Kinh độ xuất phát không hợp lệ.';
    }
    if (isNaN(formData.endLat) || formData.endLat < -90 || formData.endLat > 90) {
      errs.endLat = 'Vĩ độ kết thúc không hợp lệ.';
    }
    if (isNaN(formData.endLng) || formData.endLng < -180 || formData.endLng > 180) {
      errs.endLng = 'Kinh độ kết thúc không hợp lệ.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (onShowToast) {
        onShowToast('Vui lòng kiểm tra lại tọa độ GPS tại Bước 2!', 'error');
      }
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.coverImage.trim()) {
      errs.coverImage = 'Vui lòng chọn hoặc dán đường dẫn ảnh bìa cung đường.';
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errs.description = 'Mô tả tổng quan cần ít nhất 10 ký tự.';
    }
    if (!formData.transportationInfo.trim() || formData.transportationInfo.trim().length < 5) {
      errs.transportationInfo = 'Hướng dẫn di chuyển cần ít nhất 5 ký tự.';
    }
    if (formData.permitRequired && !formData.permitInfo.trim()) {
      errs.permitInfo = 'Vui lòng nhập tên đơn vị cấp phép.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (onShowToast) {
        onShowToast('Vui lòng điền đủ ảnh bìa và mô tả tại Bước 3!', 'error');
      }
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
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;
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

      // Ensure coverImage is uploaded directly to Cloudinary CDN folder trekmap/trails
      let finalCoverImage = formData.coverImage;
      if (finalCoverImage && !finalCoverImage.includes('res.cloudinary.com')) {
        try {
          const cloudinaryUrl = await uploadImageToCloudinary(finalCoverImage, `trail_cover_${Date.now()}`, 'trails');
          if (cloudinaryUrl) {
            finalCoverImage = cloudinaryUrl;
          }
        } catch (imgErr) {
          console.warn('⚠️ [Cloudinary Cover Image Upload Warning]:', imgErr);
        }
      }

      const token = localStorage.getItem('trekmap_token');
      const currentUserStr = localStorage.getItem('trekmap_user');
      let authorEmail = currentUser?.email || '';
      let authorName = currentUser?.fullName || currentUser?.name || currentUser?.username || '';
      let authorAvatar = currentUser?.avatarUrl || currentUser?.avatar || '';
      let userId = (currentUser as any)?._id || currentUser?.id || '';

      if (!authorEmail && currentUserStr) {
        try {
          const userObj = JSON.parse(currentUserStr);
          authorEmail = userObj.email || authorEmail;
          authorName = userObj.fullName || userObj.name || userObj.username || authorName;
          authorAvatar = userObj.avatarUrl || userObj.avatar || authorAvatar;
          userId = userObj._id || userObj.id || userId;
        } catch (e) {
          console.error(e);
        }
      }

      if (!authorEmail && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          authorEmail = payload.email || authorEmail;
          authorName = payload.fullName || payload.name || authorName;
          userId = payload.userId || payload.id || userId;
        } catch (e) {
          console.error(e);
        }
      }

      if (!authorName) authorName = 'Hoang';
      if (!authorEmail) authorEmail = 'ht20041975@outlook.com.vn';
      if (!authorAvatar) authorAvatar = 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';

      const newContribution = {
        ...formData,
        coverImage: finalCoverImage,
        id: contribId,
        authorEmail,
        authorName,
        authorAvatar,
        userId,
        name: formData.name || 'Cung đường Trekking mới',
        status: 'pending',
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };

      const savedContributions = JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
      let updatedContributions = savedContributions;

      if (editingStr) {
        updatedContributions = savedContributions.map((c: any) =>
          c.id === contribId ? { ...c, ...newContribution } : c
        );
        localStorage.removeItem('trekmap_editing_contribution');
      } else {
        updatedContributions = [newContribution, ...savedContributions];
      }

      localStorage.setItem('trekmap_contributions', JSON.stringify(updatedContributions));

      // Persist directly to MongoDB Database
      try {
        await fetch('http://localhost:5000/api/contributions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(newContribution),
        });
      } catch (mongoErr) {
        console.warn('⚠️ [MongoDB Contribution Notice]: Saved locally, backend sync pending.', mongoErr);
      }

      await submitTrailContribution({
        ...formData,
        altNames: formData.altNames.split(',').map((s) => s.trim()).filter(Boolean),
        gpxTrack: [
          [formData.startLat, formData.startLng],
          [formData.startLat + 0.01, formData.startLng + 0.01],
          [formData.startLat + 0.02, formData.startLng + 0.02],
        ],
      });
      setLoading(false);
      if (onShowToast) {
        const toastMsg = isEditing
          ? 'Cập nhật thay đổi bài đóng góp thành công!'
          : 'Gửi đóng góp cung đường thành công! Bài viết đã được ghi nhận và chuyển tới Ban Quản Trị duyệt.';
        onShowToast(toastMsg, 'success');
      }
      onSuccess();
    } catch (err) {
      setLoading(false);
      if (onShowToast) {
        onShowToast('Không thể gửi bài đóng góp, vui lòng thử lại.', 'error');
      }
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '30px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      <button className="btn btn-outline" onClick={onBack} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Hủy & Quay lại
      </button>

      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 20, textAlign: 'center' }}>
          {isEditing ? 'Chỉnh sửa thông tin bài đóng góp cung đường' : 'Đóng góp cung đường Trekking mới cho cộng đồng'}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {['1. Thông tin cơ bản', '2. Bản đồ & Tọa độ', '3. Hình ảnh & Chi tiết', '4. Xem trước & Gửi'].map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;

            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: isDone ? '#10b981' : isActive ? '#3b82f6' : '#334155',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  marginBottom: 6,
                }}>
                  {isDone ? '✓' : stepNum}
                </div>
                <span style={{ fontSize: '0.75rem', color: isActive ? '#3b82f6' : isDone ? '#10b981' : '#94a3b8', fontWeight: isActive ? 700 : 400, textAlign: 'center' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {step === 1 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: 16 }}>
            {isEditing ? 'Bước 1: Chỉnh sửa thông tin cơ bản & địa điểm' : 'Bước 1: Thông tin tên & Địa điểm cung đường'}
          </h3>

          <div className="form-group">
            <label className="form-label">Tên cung đường chính *</label>
            <input
              type="text"
              className="form-input"
              style={{ borderColor: errors.name ? '#ef4444' : undefined }}
              placeholder="Ví dụ: Đỉnh Pu Ta Leng (Lào Cai - Lai Châu)"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
            {errors.name && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Tên gọi khác (cách nhau bởi dấu phẩy)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ví dụ: Nóc nhà thứ 2 Đông Dương, Đỉnh Tả Liên Sơn..."
              value={formData.altNames}
              onChange={(e) => handleChange('altNames', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {/* 1. Region Selector */}
            <div className="form-group">
              <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Vùng miền *</label>
              <select
                className="form-select"
                value={formData.region}
                onChange={(e) => handleRegionChange(e.target.value as Region)}
              >
                <option value="Miền Bắc">Miền Bắc</option>
                <option value="Miền Trung">Miền Trung</option>
                <option value="Miền Nam">Miền Nam</option>
              </select>
            </div>

            {/* 2. Dynamic City / Province Selector (34 Merged Provinces) */}
            <div className="form-group">
              <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Thành phố / Tỉnh *</label>
              <select
                className="form-select"
                value={formData.province}
                onChange={(e) => handleProvinceChange(e.target.value)}
              >
                {(VIETNAM_ADMINISTRATIVE_DATA[formData.region] || []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Dynamic Ward / Commune Selector with Custom Input fallback */}
            <div className="form-group">
              <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Phường / Xã *</label>
              <select
                className="form-select"
                value={isCustomWard ? 'CUSTOM_WARD_OPTION' : formData.district}
                onChange={(e) => handleWardSelect(e.target.value)}
              >
                {((VIETNAM_ADMINISTRATIVE_DATA[formData.region] || []).find((p) => p.name === formData.province)?.wards || []).map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
                <option value="CUSTOM_WARD_OPTION">✏️ + Nhập tên Phường / Xã khác...</option>
              </select>

              {isCustomWard && (
                <input
                  type="text"
                  className="form-input"
                  style={{ marginTop: 8 }}
                  placeholder="Nhập tên Phường / Xã thực tế của bạn..."
                  value={customWardText}
                  onChange={(e) => {
                    setCustomWardText(e.target.value);
                    handleChange('district', e.target.value);
                  }}
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* 4. Hamlet / Village / Basecamp Location */}
          <div className="form-group">
            <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Thôn / Ấp / Bản / Trạm Cửa Rừng (Căn cứ xuất phát) *</label>
            <input
              type="text"
              className="form-input"
              style={{ borderColor: errors.hamlet ? '#ef4444' : undefined }}
              placeholder="Ví dụ: Bản Y Tý, Bản Tả Lèng, Trạm Tôn 1,900m, Basecamp Ma Lé..."
              value={formData.hamlet || ''}
              onChange={(e) => handleChange('hamlet', e.target.value)}
            />
            {errors.hamlet && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.hamlet}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Độ dài (km) *</label>
              <input
                type="number"
                className="form-input"
                style={{ borderColor: errors.distanceKm ? '#ef4444' : undefined }}
                value={formData.distanceKm}
                onChange={(e) => handleChange('distanceKm', Number(e.target.value))}
              />
              {errors.distanceKm && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.distanceKm}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Độ cao tích lũy (+m) *</label>
              <input
                type="number"
                className="form-input"
                style={{ borderColor: errors.elevationGainM ? '#ef4444' : undefined }}
                value={formData.elevationGainM}
                onChange={(e) => handleChange('elevationGainM', Number(e.target.value))}
              />
              {errors.elevationGainM && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.elevationGainM}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ height: 24, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>Cao độ đỉnh max (m) *</label>
              <input
                type="number"
                className="form-input"
                style={{ borderColor: errors.maxAltitudeM ? '#ef4444' : undefined }}
                value={formData.maxAltitudeM}
                onChange={(e) => handleChange('maxAltitudeM', Number(e.target.value))}
              />
              {errors.maxAltitudeM && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.maxAltitudeM}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Thời gian hoàn thành dự kiến *</label>
            <select
              className="form-select"
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
              <option value="1 ngày">1 ngày</option>
              <option value="2 ngày 1 đêm">2 ngày 1 đêm</option>
              <option value="3 ngày 2 đêm">3 ngày 2 đêm</option>
              <option value="4 ngày 3 đêm">4 ngày 3 đêm</option>
              <option value="Nửa ngày">Nửa ngày</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mức độ khó (Thang điểm 1 - 5) *</label>
            <select className="form-select" value={formData.difficultyLevel} onChange={(e) => handleChange('difficultyLevel', Number(e.target.value))}>
              <option value={1}>1/5 - Rất dễ (Phù hợp trẻ em & người mới)</option>
              <option value={2}>2/5 - Dễ (Đường thoải, thích hợp gia đình)</option>
              <option value={3}>3/5 - Trung bình (Cần thể lực tốt, dốc liên tục 2-3h)</option>
              <option value={4}>4/5 - Thử thách (Đường rêu trượt, dốc đứng, đu dây)</option>
              <option value={5}>5/5 - Khó nguy hiểm (Cực kỳ tốn sức, cần kỹ năng leo núi chuyên nghiệp)</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={() => { if (validateStep1()) setStep(2); }} style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            Tiếp theo: Bản đồ & Tọa độ <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginBottom: 16 }}>Bước 2: Đánh dấu Tọa độ & Tuyến đường</h3>

          {/* 2-Column Grid: Map/Inputs on Left + Guide Panel on Right */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
            
            {/* LEFT COLUMN: Map Canvas & Inputs */}
            <div>
              {/* Toolbar: Pin Mode (Left) + Map Tile Selector (Right) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', background: 'var(--color-bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <button
                    type="button"
                    onClick={() => setPinMode('start')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: pinMode === 'start' ? 'var(--color-primary)' : 'transparent',
                      color: pinMode === 'start' ? '#ffffff' : 'var(--color-text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    1. Điểm Xuất Phát
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinMode('end')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: pinMode === 'end' ? '#ef4444' : 'transparent',
                      color: pinMode === 'end' ? '#ffffff' : 'var(--color-text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    2. Điểm Kết Thúc
                  </button>
                </div>

                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 10px' }}
                  value={mapTileType}
                  onChange={(e: any) => setMapTileType(e.target.value)}
                >
                  <option value="satellite">Vệ Tinh (Esri World)</option>
                  <option value="terrain">Địa Hình (OpenTopoMap)</option>
                  <option value="osm">Đường Phố (OpenStreetMap)</option>
                </select>
              </div>

              {/* Map Canvas */}
              <div style={{ height: 350, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 14, position: 'relative', zIndex: 1 }}>
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
                    attribution={
                      mapTileType === 'satellite'
                        ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
                        : mapTileType === 'terrain'
                        ? '&copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
                        : '&copy; OpenStreetMap contributors'
                    }
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

                  {/* Start Point Marker */}
                  <Marker position={[formData.startLat, formData.startLng]} icon={greenPinIcon}>
                    <Popup>
                      <div style={{ textAlign: 'center', padding: 4 }}>
                        <strong style={{ color: '#10b981' }}>1. Điểm Xuất Phát (Cửa Rừng):</strong><br />
                        <span>Vĩ độ: {formData.startLat}</span><br />
                        <span>Kinh độ: {formData.startLng}</span>
                      </div>
                    </Popup>
                  </Marker>

                  {/* End Point Marker */}
                  <Marker position={[formData.endLat, formData.endLng]} icon={redPinIcon}>
                    <Popup>
                      <div style={{ textAlign: 'center', padding: 4 }}>
                        <strong style={{ color: '#ef4444' }}>2. Điểm Đỉnh Núi / Kết Thúc:</strong><br />
                        <span>Vĩ độ: {formData.endLat}</span><br />
                        <span>Kinh độ: {formData.endLng}</span>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Polyline Route Line */}
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
                    dashArray={gpxTrack.length === 0 ? '6, 6' : undefined}
                  />
                </MapContainer>
              </div>

              {/* GPX Upload Bar - Custom Design System Styling */}
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', fontWeight: 600 }}>Tải lên tệp GPX (Nếu có):</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label
                    htmlFor="gpx-file-upload-input"
                    className="btn btn-outline"
                    style={{ padding: '6px 14px', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 8, height: 32, display: 'inline-flex', alignItems: 'center' }}
                  >
                    Chọn tệp GPX
                  </label>
                  <span style={{ fontSize: '0.78rem', color: gpxFileName ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: gpxFileName ? 600 : 400, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gpxFileName || 'Chưa chọn tệp'}
                  </span>
                  <input
                    id="gpx-file-upload-input"
                    type="file"
                    accept=".gpx"
                    onChange={handleGpxUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Dual Coordinates Inputs - Equal 50/50 Grid Distribution */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                {/* Start Point Box */}
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 14, borderRadius: 10, width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#10b981', height: 22, display: 'flex', alignItems: 'center', marginBottom: 10, whiteSpace: 'nowrap' }}>
                    1. Tọa độ Xuất Phát
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', height: 18, display: 'flex', alignItems: 'center', marginBottom: 4, whiteSpace: 'nowrap' }}>Vĩ độ (Lat)</label>
                      <input
                        type="number"
                        step="0.00001"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                        value={formData.startLat}
                        onChange={(e) => handleChange('startLat', Number(e.target.value))}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', height: 18, display: 'flex', alignItems: 'center', marginBottom: 4, whiteSpace: 'nowrap' }}>Kinh độ (Lng)</label>
                      <input
                        type="number"
                        step="0.00001"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                        value={formData.startLng}
                        onChange={(e) => handleChange('startLng', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* End Point Box */}
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 14, borderRadius: 10, width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#ef4444', height: 22, display: 'flex', alignItems: 'center', marginBottom: 10, whiteSpace: 'nowrap' }}>
                    2. Tọa độ Kết Thúc
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', height: 18, display: 'flex', alignItems: 'center', marginBottom: 4, whiteSpace: 'nowrap' }}>Vĩ độ (Lat)</label>
                      <input
                        type="number"
                        step="0.00001"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                        value={formData.endLat}
                        onChange={(e) => handleChange('endLat', Number(e.target.value))}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', height: 18, display: 'flex', alignItems: 'center', marginBottom: 4, whiteSpace: 'nowrap' }}>Kinh độ (Lng)</label>
                      <input
                        type="number"
                        step="0.00001"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                        value={formData.endLng}
                        onChange={(e) => handleChange('endLng', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Guide & Legend Panel (Bảng Chú Thích & Hướng Dẫn) */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, position: 'sticky', top: 20 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                Chú Thích & Hướng Dẫn
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Rule 1 */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#10b981', marginBottom: 4 }}>
                    1. Chấm Điểm Xuất Phát
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4, margin: 0 }}>
                    Chọn nút <strong>"1. Điểm Xuất Phát"</strong> ở góc trái bản đồ, sau đó nhấp vào vị trí chân núi / cửa rừng để thả ghim vị trí bắt đầu leo.
                  </p>
                </div>

                {/* Rule 2 */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#ef4444', marginBottom: 4 }}>
                    2. Chấm Điểm Kết Thúc
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4, margin: 0 }}>
                    Chọn nút <strong>"2. Điểm Kết Thúc"</strong>, sau đó nhấp vào vị trí đỉnh núi hoặc điểm hạ sơn để thả ghim kết thúc.
                  </p>
                </div>

                {/* Rule 3 */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: 4 }}>
                    3. Tải Tệp GPX Tuyến Đường
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4, margin: 0 }}>
                    Nếu bạn có tệp <code>.gpx</code> xuất từ Garmin, Strava hoặc Wikiloc, hãy chọn tệp để máy tự động vẽ tuyến đường mòn và đọc tọa độ.
                  </p>
                </div>

                {/* Rule 4 */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: 4 }}>
                    4. Nhập Tọa Độ Thủ Công
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4, margin: 0 }}>
                    Bạn cũng có thể gõ trực tiếp tọa độ thập phân (Ví dụ: 16.0544, 108.2022) vào các ô bên dưới nếu đã biết trước.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button className="btn btn-primary" onClick={() => { if (validateStep2()) setStep(3); }} style={{ flex: 1, justifyContent: 'center' }}>
              Tiếp theo: Mô tả & Ảnh <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginBottom: 16 }}>Bước 3: Mô tả chi tiết & Ảnh bìa cung đường</h3>

          {/* Cover Image Selection Block */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: 8 }}>Ảnh bìa đại diện cung đường *</label>

            {/* Upload Action Bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <label
                htmlFor="cover-image-file-input"
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.82rem', cursor: 'pointer', borderRadius: 8 }}
              >
                {uploadingImage ? 'Đang tải lên...' : 'Tải ảnh từ thiết bị'}
              </label>
              <input
                id="cover-image-file-input"
                type="file"
                accept="image/*"
                disabled={uploadingImage}
                onChange={handleCoverImageUpload}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                (Hoặc dán trực tiếp đường link URL ảnh bên dưới)
              </span>
            </div>

            <input
              type="text"
              className="form-input"
              style={{ borderColor: errors.coverImage ? '#ef4444' : undefined }}
              placeholder="https://domain.com/path-to-image.jpg"
              value={formData.coverImage}
              onChange={(e) => handleChange('coverImage', e.target.value)}
            />
            {errors.coverImage && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.coverImage}</div>}

            {/* Live Image Preview showing 100% full image without cropping */}
            {formData.coverImage && (
              <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1319', padding: 8, position: 'relative' }}>
                <img
                  src={formData.coverImage}
                  alt="Ảnh bìa xem trước"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80';
                  }}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả tổng quan cung đường *</label>
            <textarea
              className="form-textarea"
              rows={4}
              style={{ borderColor: errors.description ? '#ef4444' : undefined }}
              placeholder="Mô tả về cảnh đẹp, điểm đặc sắc, các mốc thời gian..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
            {errors.description && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.description}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Hướng dẫn di chuyển đến điểm bắt đầu *</label>
            <textarea
              className="form-textarea"
              rows={3}
              style={{ borderColor: errors.transportationInfo ? '#ef4444' : undefined }}
              placeholder="Bắt xe khách từ đâu, đi xe máy qua đèo nào..."
              value={formData.transportationInfo}
              onChange={(e) => handleChange('transportationInfo', e.target.value)}
            />
            {errors.transportationInfo && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.transportationInfo}</div>}
          </div>

          {/* Facilities & Permit Options */}
          <div className="form-group" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: 12, display: 'block' }}>
              Đặc điểm & Tiện ích cung đường (Chọn các thuộc tính phù hợp)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={formData.permitRequired}
                  onChange={(e) => handleChange('permitRequired', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.83rem', color: 'var(--color-text-main)', fontWeight: 600 }}>Cần giấy phép VQG / Trạm KL</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={formData.hasCampsite}
                  onChange={(e) => handleChange('hasCampsite', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.83rem', color: 'var(--color-text-main)', fontWeight: 600 }}>Có bãi cắm trại dã ngoại</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={formData.hasWaterSource}
                  onChange={(e) => handleChange('hasWaterSource', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.83rem', color: 'var(--color-text-main)', fontWeight: 600 }}>Có nguồn nước tự nhiên</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={formData.kidFriendly}
                  onChange={(e) => handleChange('kidFriendly', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.83rem', color: 'var(--color-text-main)', fontWeight: 600 }}>Phù hợp cho trẻ em</span>
              </label>
            </div>

            {formData.permitRequired && (
              <div style={{ marginTop: 12 }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ borderColor: errors.permitInfo ? '#ef4444' : undefined }}
                  placeholder="Nhập tên đơn vị cấp phép (Ví dụ: Ban quản lý VQG Hoàng Liên, Trạm kiểm lâm Y Tý...)"
                  value={formData.permitInfo}
                  onChange={(e) => handleChange('permitInfo', e.target.value)}
                />
                {errors.permitInfo && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>{errors.permitInfo}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button className="btn btn-primary" onClick={() => { if (validateStep3()) setStep(4); }} style={{ flex: 1, justifyContent: 'center' }}>
              Xem trước bài đóng góp <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', marginBottom: 6, textAlign: 'center' }}>
            {isEditing ? 'Xem trước thông tin bài đóng góp (Đang chỉnh sửa)' : 'Xem trước thông tin bài đóng góp'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 20 }}>
            {isEditing ? 'Vui lòng kiểm tra kỹ các thay đổi trước khi lưu' : 'Vui lòng kiểm tra kỹ các thông tin bên dưới trước khi gửi cho Ban Quản Trị duyệt'}
          </p>

          {/* Hero Cover Image Banner */}
          {formData.coverImage && (
            <div style={{ height: 260, borderRadius: 12, overflow: 'hidden', marginBottom: 20, position: 'relative', border: '1px solid var(--color-border)', background: '#0b1319', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={formData.coverImage}
                alt={formData.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80';
                }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 20, pointerEvents: 'none' }}>
                <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6, width: 'fit-content', marginBottom: 6 }}>
                  {formData.region} • {formData.province}
                </span>
                <h2 style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 800, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {formData.name || 'Cung đường Trekking mới'}
                </h2>
              </div>
            </div>
          )}

          {/* Structured Preview Container */}
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 20, borderRadius: 12, marginBottom: 20 }}>
            {!formData.coverImage && (
              <h4 style={{ fontSize: '1.2rem', color: 'var(--color-primary)', fontWeight: 800, marginBottom: 8 }}>
                {formData.name || 'Cung đường Trekking mới'}
              </h4>
            )}

            {/* Location Tag */}
            <div style={{ color: 'var(--color-text-main)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 16 }}>
              Vị trí: {formData.hamlet ? formData.hamlet + ', ' : ''}{formData.district}, {formData.province} ({formData.region})
            </div>

            {/* 4 Metric Badges Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
              <div style={{ background: 'var(--color-bg-card, rgba(255,255,255,0.05))', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Chiều dài</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>{formData.distanceKm} km</div>
              </div>
              <div style={{ background: 'var(--color-bg-card, rgba(255,255,255,0.05))', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Độ cao nâng</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>+{formData.elevationGainM} m</div>
              </div>
              <div style={{ background: 'var(--color-bg-card, rgba(255,255,255,0.05))', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Thời gian đi</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>{formData.durationHoursNote}</div>
              </div>
              <div style={{ background: 'var(--color-bg-card, rgba(255,255,255,0.05))', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Mức độ khó</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>{formData.difficultyLevel}/5</div>
              </div>
            </div>

            {/* Coordinates Section */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Tọa độ GPS đã đánh dấu:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                <div>• Xuất phát (Start): <code>{formData.startLat}, {formData.startLng}</code></div>
                <div>• Kết thúc (End): <code>{formData.endLat}, {formData.endLng}</code></div>
              </div>
            </div>

            {/* Description */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Mô tả tổng quan cung đường:
              </div>
              <p style={{ color: 'var(--color-text-main)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>
                {formData.description || 'Chưa nhập nội dung mô tả.'}
              </p>
            </div>

            {/* Transportation */}
            {formData.transportationInfo && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, marginBottom: 16 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                  Hướng dẫn di chuyển:
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
                  {formData.transportationInfo}
                </p>
              </div>
            )}

            {/* Facilities & Permit Info */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <span>Giấy phép: <strong>{formData.permitRequired ? (formData.permitInfo || 'Cần giấy phép') : 'Không cần giấy phép'}</strong></span>
              <span>Bãi cắm trại: <strong>{formData.hasCampsite ? 'Có' : 'Không'}</strong></span>
              <span>Nguồn nước: <strong>{formData.hasWaterSource ? 'Có' : 'Không'}</strong></span>
              <span>Trẻ em: <strong>{formData.kidFriendly ? 'Phù hợp' : 'Không phù hợp'}</strong></span>
            </div>

          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowLeft size={16} /> Quay lại sửa thông tin
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{ flex: 2, justifyContent: 'center' }}
            >
              {loading
                ? (isEditing ? 'Đang lưu thay đổi...' : 'Đang gửi bài...')
                : (isEditing ? 'Cập nhật & Lưu thay đổi bài đóng góp' : 'Xác nhận & Nộp bài cho BQT duyệt')
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
