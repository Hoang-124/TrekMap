import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { submitTrailContribution, updateTrailContribution, uploadImageToCloudinary } from '../../services/api.js';
import { haversineMeters } from '../../utils/geoMath.js';
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
  IconCheck,
  IconX,
  IconClock,
  IconPlus,
  IconTrash,
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

// Pure SVG Leaflet Pin Icons (Rule 12 compliant - zero external CDN PNG markers; Leaflet divIcon SVG colors)
const createSvgPin = (fill: string) =>
  L.divIcon({
    html: `<svg width="28" height="38" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));"><path d="M15 1.5C7.5 1.5 1.5 7.5 1.5 15C1.5 24.8 13.6 36.8 14.5 37.7C14.8 38 15.2 38 15.5 37.7C16.4 36.8 28.5 24.8 28.5 15C28.5 7.5 22.5 1.5 15 1.5Z" fill="${fill}" stroke="#ffffff" stroke-width="2.4"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>`,
    className: 'custom-contrib-svg-pin',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });

const greenPinIcon = createSvgPin('#1f6f4a');
const redPinIcon = createSvgPin('#b83c32');
const bluePinIcon = createSvgPin('#2c6a8e');

function MapClickListener({ onSelectCoords }: { onSelectCoords: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelectCoords(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    },
  });
  return null;
}

function MapBoundsFitter({
  gpxTrack,
  start,
  end,
  fitVersion,
}: {
  gpxTrack: [number, number][];
  start: [number, number];
  end: [number, number];
  fitVersion: number;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = gpxTrack.length >= 2 ? gpxTrack : [start, end];
    const valid = pts.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (valid.length >= 2) {
      const bounds = L.latLngBounds(valid);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
    } else if (valid.length === 1) {
      map.setView(valid[0], 13);
    }
  }, [map, gpxTrack, fitVersion]); // eslint-disable-line react-hooks/exhaustive-deps
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
    { name: 'Tỉnh Hà Giang', wards: ['Phường Hà Giang', 'Xã Đồng Văn', 'Xã Mèo Vạc', 'Xã Lũng Cú', 'Xã Thông Nguyên', 'Xã Quản Bạ', 'Xã Cao Bồ'] },
    { name: 'Tỉnh Lai Châu', wards: ['Phường Lai Châu', 'Xã Tam Đường', 'Xã Tả Liên', 'Xã Sơn Bình', 'Xã Hồ Thầu', 'Xã Sìn Hồ', 'Xã Pa Vệ Sử'] },
    { name: 'Tỉnh Sơn La', wards: ['Phường Sơn La', 'Xã Bắc Yên', 'Xã Tà Xùa', 'Phường Mộc Châu', 'Xã Vân Hồ'] },
    { name: 'Tỉnh Hòa Bình', wards: ['Phường Hòa Bình', 'Xã Mai Châu', 'Xã Hang Kia', 'Xã Pà Cò', 'Xã Cao Phong'] },
    { name: 'Tỉnh Cao Bằng', wards: ['Phường Cao Bằng', 'Xã Trùng Khánh', 'Xã Đàm Thủy', 'Xã Hà Quảng', 'Xã Nguyên Bình'] },
    { name: 'Tỉnh Lạng Sơn', wards: ['Phường Lạng Sơn', 'Xã Mẫu Sơn', 'Xã Hữu Lũng', 'Xã Chi Lăng'] },
    { name: 'Tỉnh Quảng Ninh', wards: ['Thành phố Hạ Long', 'Phường Yên Tử', 'Xã Bình Liêu', 'Xã Cô Tô'] },
  ],
  'Miền Trung': [
    { name: 'Thành phố Đà Nẵng', wards: ['Phường Sơn Trà', 'Phường Thọ Quang', 'Phường Hải Châu', 'Xã Hòa Bắc', 'Xã Hòa Vang', 'Xã Hòa Ninh'] },
    { name: 'Thành phố Huế', wards: ['Phường Huế', 'Phường Thuận Thành', 'Xã Bạch Mã', 'Xã A Lưới', 'Xã Nam Đông'] },
    { name: 'Tỉnh Quảng Bình', wards: ['Thành phố Đồng Hới', 'Xã Phong Nha - Kẻ Bàng', 'Xã Tân Hóa', 'Xã Bố Trạch'] },
    { name: 'Tỉnh Quảng Nam', wards: ['Thành phố Hội An', 'Thành phố Tam Kỳ', 'Xã Nam Trà My', 'Xã Phước Sơn'] },
    { name: 'Thành phố Đà Lạt (Lâm Đồng)', wards: ['Phường Đà Lạt', 'Phường Xuân Thọ', 'Xã Lạc Dương', 'Xã Bidoup', 'Xã Tà Năng', 'Xã Phan Dũng'] },
    { name: 'Tỉnh Đắk Lắk', wards: ['Thành phố Buôn Ma Thuột', 'Xã Krông Bông', 'Xã Buôn Đôn', 'Xã Lắk'] },
    { name: 'Tỉnh Gia Lai', wards: ['Thành phố Pleiku', 'Xã Chư Đăng Ya', 'Xã Kbang', 'Xã Mang Yang'] },
    { name: 'Tỉnh Kon Tum', wards: ['Thành phố Kon Tum', 'Xã Măng Đen', 'Xã Đắk Glei', 'Xã Tu Mơ Rông'] },
    { name: 'Tỉnh Ninh Thuận', wards: ['Thành phố Phan Rang', 'Xã Phước Bình', 'Xã Vĩnh Hy', 'Xã Vĩnh Hải'] },
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
  'Tỉnh Kon Tum': [14.3497, 108.0005],
  'Tỉnh Ninh Thuận': [11.7165, 109.193],
  'Tỉnh Bình Thuận': [11.3515, 108.6455],
  'Thành phố Hà Nội': [21.0285, 105.8542],
  'Thành phố Hồ Chí Minh': [10.8231, 106.6297],
  'Tỉnh Bà Rịa - Vũng Tàu': [10.521, 107.116],
  'Tỉnh Đồng Nai': [11.4235, 107.4285],
  'Tỉnh Tây Ninh': [11.367, 106.167],
  'Tỉnh An Giang': [10.3759, 105.4185],
  'Tỉnh Kiên Giang': [10.227, 103.963],
};

// 100% Source-Verified Vietnam National Parks & Provincial Forestry Rescue Contacts (Rule 11)
const VERIFIED_PROVINCE_RESCUE: Record<string, { name: string; phone: string; rangerContact: string }> = {
  'Tỉnh Lào Cai': {
    name: 'VQG Hoàng Liên & Chi Cục Kiểm Lâm Lào Cai',
    phone: '02143.871.494',
    rangerContact: '0985.834.581 / Trạm Kiểm Lâm Trạm Tôn',
  },
  'Tỉnh Yên Bái': {
    name: 'Chi Cục Kiểm Lâm Yên Bái',
    phone: '02163.852.341',
    rangerContact: 'Hạt Kiểm Lâm địa phương / 112',
  },
  'Tỉnh Lai Châu': {
    name: 'Chi Cục Kiểm Lâm Lai Châu',
    phone: '02133.876.605',
    rangerContact: 'Hạt Kiểm Lâm địa phương / 112',
  },
  'Tỉnh Hà Giang': {
    name: 'Chi Cục Kiểm Lâm Hà Giang',
    phone: '0219.3861.628',
    rangerContact: 'Hạt Kiểm Lâm địa phương / 112',
  },
  'Thành phố Hà Nội': {
    name: 'VQG Ba Vì (Ba Vì, Hà Nội)',
    phone: '02433.881.082',
    rangerContact: '0966.173.119 / 114',
  },
  'Thành phố Huế': {
    name: 'VQG Bạch Mã (Phú Lộc, TP. Huế)',
    phone: '0234.3871.330',
    rangerContact: '0836.356.669 / Trạm Kiểm Lâm VQG Bạch Mã',
  },
  'Tỉnh Quảng Bình': {
    name: 'VQG Phong Nha - Kẻ Bàng (Quảng Bình)',
    phone: '0918.841.455',
    rangerContact: '0868.815.678 / 114',
  },
  'Thành phố Đà Lạt (Lâm Đồng)': {
    name: 'VQG Bidoup - Núi Bà & Chi Cục KL Lâm Đồng',
    phone: '0263.3502.005',
    rangerContact: '02633.822.441 / 0947.047.449',
  },
  'Tỉnh Đắk Lắk': {
    name: 'VQG Chư Yang Sin (Krông Bông, Đắk Lắk)',
    phone: '0262.3734.226',
    rangerContact: 'Trạm Kiểm Lâm VQG Chư Yang Sin / 112',
  },
  'Tỉnh Gia Lai': {
    name: 'Khu BTTN Kon Chư Răng (Kbang, Gia Lai)',
    phone: '0985.551.682',
    rangerContact: '0978.035.772 / 112',
  },
  'Tỉnh Ninh Thuận': {
    name: 'VQG Núi Chúa (Ninh Hải, Ninh Thuận)',
    phone: '0798.889.468',
    rangerContact: 'TT Du lịch & GDMT VQG Núi Chúa / 112',
  },
  'Tỉnh Đồng Nai': {
    name: 'VQG Cát Tiên & Chi Cục KL Đồng Nai',
    phone: '02513.669.228',
    rangerContact: '0251.3992.053 / 0856.669.228',
  },
  'Tỉnh Tây Ninh': {
    name: 'Đội CNCH KDL Quốc Gia Núi Bà Đen 24/24',
    phone: '0276.387.5678',
    rangerContact: 'BQL KDL 0276.3823.378 / 114',
  },
};

function getRescueContactForProvince(province: string): { name: string; phone: string; rangerContact: string } {
  const verified = VERIFIED_PROVINCE_RESCUE[province];
  if (verified) return { ...verified };
  const cleanProvince = province.replace(/^(Tỉnh |Thành phố )/, '').trim() || 'địa phương';
  return {
    name: `Chi Cục Kiểm Lâm ${cleanProvince}`,
    phone: '112 / 114',
    rangerContact: `Hạt Kiểm Lâm ${cleanProvince} / Tổng đài 112`,
  };
}

const WAYPOINT_TYPE_LABELS: Record<Waypoint['type'], string> = {
  campsite: 'Bãi cắm trại / Lán nghỉ',
  water: 'Nguồn nước suối',
  viewpoint: 'Điểm ngắm cảnh / Đỉnh phụ',
  danger: 'Đoạn nguy hiểm / Dốc đứng',
  rest: 'Điểm dừng chân',
  charging: 'Trạm hỗ trợ / Điện',
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = Boolean(editingId);
  const [pinMode, setPinMode] = useState<'start' | 'end' | 'waypoint'>('start');
  const [mapTileType, setMapTileType] = useState<'satellite' | 'terrain' | 'osm'>('satellite');
  const [gpxTrack, setGpxTrack] = useState<[number, number][]>([]);
  const [gpxFileName, setGpxFileName] = useState<string>('');
  const [mapFitVersion, setMapFitVersion] = useState<number>(0);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Optional Waypoint editor form state (Step 3)
  const [wpName, setWpName] = useState('');
  const [wpType, setWpType] = useState<Waypoint['type']>('campsite');
  const [wpElevation, setWpElevation] = useState('');
  const [wpLat, setWpLat] = useState('');
  const [wpLng, setWpLng] = useState('');
  const [wpDesc, setWpDesc] = useState('');

  // Form State adhering 100% to MongoDB Trail & Contribution schema
  const [formData, setFormData] = useState({
    name: '',
    altNames: '',
    province: 'Tỉnh Lào Cai',
    district: 'Phường Sa Pa',
    hamlet: 'Trạm Kiểm Lâm Trạm Tôn',
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
    rescueContact: getRescueContactForProvince('Tỉnh Lào Cai'),
    waypoints: [] as Waypoint[],
    startLat: 22.3364,
    startLng: 103.8438,
    endLat: 22.3512,
    endLng: 103.864,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const hydrateFromEditItem = (editingItem: Record<string, unknown>, isRealEdit: boolean) => {
      if (isRealEdit && (editingItem.id || editingItem._id)) {
        setEditingId(String(editingItem.id || editingItem._id));
      }

      const rawRegion = String(editingItem.region || 'Miền Bắc');
      const editRegion: Region =
        rawRegion === 'Miền Bắc' || rawRegion === 'Miền Trung' || rawRegion === 'Miền Nam'
          ? rawRegion
          : 'Miền Bắc';

      const provinceList = VIETNAM_ADMINISTRATIVE_DATA[editRegion] || [];
      const rawProvince = String(editingItem.province || '').trim();
      const matchedProvince =
        provinceList.find((p) => p.name === rawProvince) ||
        provinceList.find((p) =>
          rawProvince &&
          (p.name.toLowerCase().includes(rawProvince.toLowerCase()) ||
            rawProvince.toLowerCase().includes(p.name.replace(/^(Tỉnh |Thành phố )/, '').toLowerCase()))
        ) ||
        provinceList[0];

      const editProvince = matchedProvince ? matchedProvince.name : (rawProvince || 'Tỉnh Lào Cai');
      const rawDistrict = String(editingItem.district || '').trim();
      const resolvedDistrict = rawDistrict || matchedProvince?.wards[0] || '';

      if (resolvedDistrict && (!matchedProvince || !matchedProvince.wards.includes(resolvedDistrict))) {
        setIsCustomWard(true);
        setCustomWardText(resolvedDistrict);
      } else {
        setIsCustomWard(false);
        setCustomWardText('');
      }

      const rawGpx = Array.isArray(editingItem.gpxTrack)
        ? (editingItem.gpxTrack as unknown[])
            .filter(
              (pt): pt is [number, number] =>
                Array.isArray(pt) &&
                pt.length >= 2 &&
                Number.isFinite(Number(pt[0])) &&
                Number.isFinite(Number(pt[1]))
            )
            .map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number])
        : [];

      const fallbackCoords = PROVINCE_COORDINATES[editProvince] || [22.3364, 103.8438];
      const startLat = Number.isFinite(Number(editingItem.startLat))
        ? Number(editingItem.startLat)
        : rawGpx[0]?.[0] ?? fallbackCoords[0];
      const startLng = Number.isFinite(Number(editingItem.startLng))
        ? Number(editingItem.startLng)
        : rawGpx[0]?.[1] ?? fallbackCoords[1];
      const endLat = Number.isFinite(Number(editingItem.endLat))
        ? Number(editingItem.endLat)
        : rawGpx[rawGpx.length - 1]?.[0] ?? fallbackCoords[0];
      const endLng = Number.isFinite(Number(editingItem.endLng))
        ? Number(editingItem.endLng)
        : rawGpx[rawGpx.length - 1]?.[1] ?? fallbackCoords[1];

      const resolvedName = String(editingItem.name || editingItem.title || '').trim();
      const validDifficulty = Math.min(5, Math.max(1, Math.round(Number(editingItem.difficultyLevel) || 3)));
      const validDistance = Number.isFinite(Number(editingItem.distanceKm)) && Number(editingItem.distanceKm) > 0
        ? Number(editingItem.distanceKm)
        : undefined;
      const validGain = Number.isFinite(Number(editingItem.elevationGainM)) && Number(editingItem.elevationGainM) >= 0
        ? Math.round(Number(editingItem.elevationGainM))
        : undefined;
      const validMaxAlt = Number.isFinite(Number(editingItem.maxAltitudeM)) && Number(editingItem.maxAltitudeM) > 0
        ? Math.round(Number(editingItem.maxAltitudeM))
        : undefined;

      setFormData((prev) => ({
        ...prev,
        ...(isRealEdit ? editingItem : {}),
        name: resolvedName || prev.name,
        description: typeof editingItem.description === 'string' && editingItem.description.trim()
          ? editingItem.description
          : prev.description,
        region: editRegion,
        province: editProvince,
        district: resolvedDistrict || prev.district,
        distanceKm: validDistance ?? prev.distanceKm,
        elevationGainM: validGain ?? prev.elevationGainM,
        maxAltitudeM: validMaxAlt ?? prev.maxAltitudeM,
        difficultyLevel: validDifficulty,
        durationDays: Number.isFinite(Number(editingItem.durationDays)) && Number(editingItem.durationDays) >= 1
          ? Math.round(Number(editingItem.durationDays))
          : prev.durationDays,
        durationHoursNote: typeof editingItem.durationHoursNote === 'string' && editingItem.durationHoursNote.trim()
          ? editingItem.durationHoursNote
          : prev.durationHoursNote,
        altNames: Array.isArray(editingItem.altNames)
          ? (editingItem.altNames as string[]).join(', ')
          : typeof editingItem.altNames === 'string'
            ? editingItem.altNames
            : prev.altNames,
        bestMonths: Array.isArray(editingItem.bestMonths) ? (editingItem.bestMonths as number[]) : prev.bestMonths,
        avoidMonths: Array.isArray(editingItem.avoidMonths) ? (editingItem.avoidMonths as number[]) : prev.avoidMonths,
        waypoints: Array.isArray(editingItem.waypoints) ? (editingItem.waypoints as Waypoint[]) : prev.waypoints,
        rescueContact:
          editingItem.rescueContact && typeof editingItem.rescueContact === 'object'
            ? (editingItem.rescueContact as { name: string; phone: string; rangerContact: string })
            : getRescueContactForProvince(editProvince),
        startLat,
        startLng,
        endLat,
        endLng,
      }));

      if (rawGpx.length > 0) {
        setGpxTrack(rawGpx);
        if (!isRealEdit) {
          setGpxFileName('Tuyến tự vẽ từ Thiết Kế GPX LOST');
        }
        setMapFitVersion((v) => v + 1);
      }
    };

    // 1. Check if user is explicitly editing an existing submitted contribution (has id/_id)
    const editingStr = localStorage.getItem('lost_editing_contribution');
    let hasActiveExistingEdit = false;
    if (editingStr) {
      try {
        const editingItem = JSON.parse(editingStr) as Record<string, unknown>;
        if (editingItem && (editingItem.id || editingItem._id)) {
          hasActiveExistingEdit = true;
          hydrateFromEditItem(editingItem, true);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 2. Otherwise, check RoutePlannerView handoff draft ('lost_planner_draft_contribution')
    if (!hasActiveExistingEdit) {
      const plannerDraftStr = localStorage.getItem('lost_planner_draft_contribution');
      if (plannerDraftStr) {
        try {
          const draft = JSON.parse(plannerDraftStr) as Record<string, unknown>;
          if (draft && typeof draft === 'object') {
            hydrateFromEditItem(draft, false);
            localStorage.removeItem('lost_planner_draft_contribution');
            // Also clean up any non-id mirror written by RoutePlannerView so future visits stay clean
            if (editingStr) {
              localStorage.removeItem('lost_editing_contribution');
            }
            const msg = 'Đã nạp tuyến đường từ Thiết Kế GPX vào biểu mẫu đóng góp!';
            if (onShowToast) {
              onShowToast(msg, 'success');
            } else {
              window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: msg, type: 'success' } }));
            }
          }
        } catch (e) {
          console.error('[Hydrate RoutePlanner Draft Error]:', e);
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelAndBack = () => {
    localStorage.removeItem('lost_editing_contribution');
    setEditingId(null);
    onBack();
  };

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 560, margin: '64px auto', padding: '40px 28px', textAlign: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 4, boxShadow: 'var(--shadow-card)' }}>
        <div className="section-eyebrow" style={{ justifyContent: 'center', marginBottom: 10 }}>Xác thực thực địa</div>
        <h2 className="font-editorial" style={{ fontSize: '1.55rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 10 }}>
          Yêu Cầu Đăng Nhập Để Đóng Góp
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 24px auto' }}>
          Để đảm bảo tính xác thực 100% dữ liệu thực địa và ghi nhận điểm uy tín (+50 điểm), bạn cần đăng nhập trước khi đóng góp cung đường mới.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={handleCancelAndBack} style={{ padding: '9px 22px', fontSize: '0.88rem', borderRadius: 4 }}>
            Quay lại
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
            }}
            style={{ padding: '9px 24px', fontSize: '0.88rem', borderRadius: 4 }}
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  const handleRegionChange = (newRegion: Region) => {
    const provinces = VIETNAM_ADMINISTRATIVE_DATA[newRegion] || [];
    const firstProvince = provinces[0]?.name || '';
    const firstWard = provinces[0]?.wards[0] || '';
    const center = PROVINCE_COORDINATES[firstProvince];
    setIsCustomWard(false);
    setCustomWardText('');
    setFormData((prev) => ({
      ...prev,
      region: newRegion,
      province: firstProvince,
      district: firstWard,
      rescueContact: getRescueContactForProvince(firstProvince),
      ...(center && gpxTrack.length === 0
        ? {
            startLat: center[0],
            startLng: center[1],
            endLat: Number((center[0] + 0.015).toFixed(5)),
            endLng: Number((center[1] + 0.015).toFixed(5)),
          }
        : {}),
    }));
    setMapFitVersion((v) => v + 1);
  };

  const handleProvinceChange = (newProvince: string) => {
    const provinces = VIETNAM_ADMINISTRATIVE_DATA[formData.region] || [];
    const found = provinces.find((p) => p.name === newProvince);
    const firstWard = found?.wards[0] || '';
    const center = PROVINCE_COORDINATES[newProvince];
    setIsCustomWard(false);
    setCustomWardText('');
    setFormData((prev) => ({
      ...prev,
      province: newProvince,
      district: firstWard,
      rescueContact: getRescueContactForProvince(newProvince),
      ...(center && gpxTrack.length === 0
        ? {
            startLat: center[0],
            startLng: center[1],
            endLat: Number((center[0] + 0.015).toFixed(5)),
            endLng: Number((center[1] + 0.015).toFixed(5)),
          }
        : {}),
    }));
    setMapFitVersion((v) => v + 1);
  };

  const handleWardSelect = (val: string) => {
    if (val === 'CUSTOM_WARD_OPTION') {
      setIsCustomWard(true);
      setFormData((prev) => ({ ...prev, district: customWardText || '' }));
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
      } catch {
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
        if (xmlDoc.querySelector('parsererror')) {
          onShowToast?.('Tệp GPX không đúng định dạng XML hợp lệ.', 'error');
          return;
        }
        const trkpts = Array.from(xmlDoc.querySelectorAll('trkpt'));
        if (trkpts.length === 0) {
          onShowToast?.('Không tìm thấy tọa độ <trkpt> nào trong tệp GPX.', 'error');
          return;
        }
        const parsed = trkpts
          .map((pt) => {
            const lat = parseFloat(pt.getAttribute('lat') || 'NaN');
            const lng = parseFloat(pt.getAttribute('lon') || 'NaN');
            const eleText = pt.querySelector('ele')?.textContent;
            const ele = eleText ? parseFloat(eleText) : NaN;
            return { lat, lng, ele };
          })
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180);

        if (parsed.length === 0) {
          onShowToast?.('Tệp GPX không chứa tọa độ địa lý hợp lệ.', 'error');
          return;
        }

        const points: [number, number][] = parsed.map((p) => [p.lat, p.lng]);

        // Calculate cumulative Haversine track distance in km
        let totalMeters = 0;
        for (let i = 1; i < points.length; i++) {
          totalMeters += haversineMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
        }
        const computedDistanceKm = Math.round((totalMeters / 1000) * 10) / 10;

        const elevations = parsed.map((p) => p.ele).filter((v) => Number.isFinite(v));
        let maxAlt: number | undefined;
        let totalGain: number | undefined;
        if (elevations.length > 0) {
          maxAlt = Math.round(Math.max(...elevations));
          let gain = 0;
          for (let i = 1; i < elevations.length; i++) {
            const diff = elevations[i] - elevations[i - 1];
            if (diff > 0) gain += diff;
          }
          totalGain = Math.round(gain);
        }

        const start = points[0];
        const end = points[points.length - 1];
        setGpxTrack(points);
        setMapFitVersion((v) => v + 1);
        setFormData((prev) => ({
          ...prev,
          startLat: Number(start[0].toFixed(5)),
          startLng: Number(start[1].toFixed(5)),
          endLat: Number(end[0].toFixed(5)),
          endLng: Number(end[1].toFixed(5)),
          ...(computedDistanceKm > 0 ? { distanceKm: computedDistanceKm } : {}),
          ...(maxAlt && maxAlt > 0 ? { maxAltitudeM: maxAlt } : {}),
          ...(totalGain !== undefined && totalGain > 0 ? { elevationGainM: totalGain } : {}),
        }));
        onShowToast?.(
          `Đã trích xuất ${points.length} điểm GPS${computedDistanceKm > 0 ? ` • ${computedDistanceKm} km` : ''}${maxAlt ? ` • đỉnh ${maxAlt}m` : ''} từ tệp GPX!`,
          'success'
        );
      } catch (err) {
        console.error('GPX parse error:', err);
        onShowToast?.('Không thể đọc tệp GPX. Vui lòng kiểm tra lại định dạng.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Optional Waypoints Editor actions
  const handleAddWaypoint = () => {
    const cleanName = wpName.trim();
    const latNum = Number(wpLat);
    const lngNum = Number(wpLng);
    if (!cleanName) {
      onShowToast?.('Vui lòng nhập tên mốc tọa độ (VD: Lán nghỉ 2.400m, Suối nguồn...).', 'error');
      return;
    }
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      onShowToast?.('Vui lòng chọn điểm trên bản đồ hoặc nhập tọa độ Lat/Lng hợp lệ cho mốc.', 'error');
      return;
    }
    const elevNum = wpElevation.trim() ? Math.round(Number(wpElevation)) : undefined;
    const newWp: Waypoint = {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      type: wpType,
      description: wpDesc.trim() || WAYPOINT_TYPE_LABELS[wpType],
      elevationM: elevNum && Number.isFinite(elevNum) ? elevNum : undefined,
      lat: Number(latNum.toFixed(5)),
      lng: Number(lngNum.toFixed(5)),
    };
    setFormData((prev) => ({ ...prev, waypoints: [...prev.waypoints, newWp] }));
    setWpName('');
    setWpElevation('');
    setWpDesc('');
    setWpLat('');
    setWpLng('');
    onShowToast?.(`Đã thêm mốc tọa độ "${cleanName}".`, 'success');
  };

  const handleRemoveWaypoint = (id: string) => {
    setFormData((prev) => ({ ...prev, waypoints: prev.waypoints.filter((w) => w.id !== id) }));
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
    if (Number.isNaN(formData.startLat) || formData.startLat < -90 || formData.startLat > 90) {
      errs.startLat = 'Vĩ độ xuất phát không hợp lệ (-90 đến 90).';
    }
    if (Number.isNaN(formData.startLng) || formData.startLng < -180 || formData.startLng > 180) {
      errs.startLng = 'Kinh độ xuất phát không hợp lệ (-180 đến 180).';
    }
    if (Number.isNaN(formData.endLat) || formData.endLat < -90 || formData.endLat > 90) {
      errs.endLat = 'Vĩ độ kết thúc không hợp lệ (-90 đến 90).';
    }
    if (Number.isNaN(formData.endLng) || formData.endLng < -180 || formData.endLng > 180) {
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

  const handleChange = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
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
    // Jump directly to the first failing step so the user sees exact validation errors!
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateStep3()) {
      setStep(3);
      return;
    }
    if (!validateStep4()) {
      setStep(4);
      return;
    }

    setLoading(true);
    try {
      let finalCoverImage = formData.coverImage;
      if (finalCoverImage && finalCoverImage.startsWith('data:image/')) {
        finalCoverImage = await uploadImageToCloudinary(finalCoverImage, `trail_cover_${Date.now()}`, 'trails');
      }

      const finalGpxTrack: [number, number][] =
        gpxTrack.length > 0
          ? gpxTrack
          : [
              [formData.startLat, formData.startLng],
              [formData.endLat, formData.endLng],
            ];

      const payload = {
        ...formData,
        coverImage: finalCoverImage,
        altNames: formData.altNames.split(',').map((s) => s.trim()).filter(Boolean),
        gpxTrack: finalGpxTrack,
      };

      if (editingId) {
        await updateTrailContribution(editingId, payload);
      } else {
        await submitTrailContribution(payload);
      }

      localStorage.removeItem('lost_editing_contribution');
      setEditingId(null);
      setLoading(false);

      const toastMsg = editingId
        ? 'Cập nhật bài đóng góp vào Database thành công!'
        : 'Đã lưu bài đóng góp vào Database thành công! Đã gửi thông báo tới Ban Quản Trị duyệt.';
      onShowToast?.(toastMsg, 'success');
      onSuccess();
    } catch (err: unknown) {
      setLoading(false);
      onShowToast?.(
        err instanceof Error && err.message
          ? err.message
          : 'Không thể lưu bài đóng góp vào Database, vui lòng thử lại.',
        'error'
      );
    }
  };

  const userAvatar = currentUser?.avatarUrl || currentUser?.avatar || '';
  const userName = currentUser?.fullName || currentUser?.name || 'Trekker Đóng Góp';

  return (
    <div style={{ maxWidth: 1240, margin: '14px auto 48px auto', padding: '0 20px', boxSizing: 'border-box' }}>
      {/* Top Action & Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 14,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Đóng góp bản đồ thực địa</div>
          <h2 className="font-editorial" style={{ fontSize: 'clamp(1.65rem, 3vw, 2.2rem)', fontWeight: 500, color: 'var(--color-text-main)', margin: 0, lineHeight: 1.08 }}>
            {isEditing ? 'Chỉnh Sửa Thông Tin Bài Đóng Góp' : 'Đóng Góp Cung Đường Mới'}
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleCancelAndBack}
          style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 4 }}
        >
          <ArrowLeft size={15} /> Hủy &amp; Quay lại
        </button>
      </div>

      {/* Swiss Editorial 5-Column Hairline Stepper */}
      <div className="editorial-stat-strip" style={{ marginBottom: 22 }}>
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
              className="editorial-stat-cell"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: isActive ? 'var(--color-surface-elevated)' : 'var(--color-bg-card)',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: stepNum < step ? 'pointer' : 'default',
              }}
            >
              <div
                className="font-editorial"
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 500,
                  color: isDone || isActive ? 'var(--color-primary)' : 'var(--color-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {isDone ? <IconCheck size={14} color="var(--color-primary)" /> : `0${stepNum}`}
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: isActive ? 'var(--color-text-main)' : isDone ? 'var(--color-text-muted)' : 'var(--color-text-dim)',
                  fontWeight: isActive ? 700 : 500,
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

      {/* Sliding Steps Container */}
      <div key={step} className="tab-content-slide">
        {/* ================= STEP 1 ================= */}
        {step === 1 && (
          <div className="card" style={{ padding: '24px 26px', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <IconCompass size={22} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.12rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
                Bước 1: Tên Cung Đường &amp; Phân Cấp Hành Chính (100% Thực Địa)
              </h3>
            </div>

            <div className="wizard-grid-2">
              <div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Tên cung đường chính *</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4, borderColor: errors.name ? 'var(--color-error)' : undefined }}
                    placeholder="Ví dụ: Chinh Phục Đỉnh Pu Ta Leng 3049m"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                  {errors.name && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.76rem', marginTop: 4, fontWeight: 600 }}>{errors.name}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Tên gọi khác / Tên đỉnh (phân tách bởi dấu phẩy)</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4 }}
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
                    style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4, borderColor: errors.hamlet ? 'var(--color-error)' : undefined }}
                    placeholder="Ví dụ: Bản Sì Thâu Chải, Trạm Tôn 1.900m, Bản Sàng Ma Sáo..."
                    value={formData.hamlet || ''}
                    onChange={(e) => handleChange('hamlet', e.target.value)}
                  />
                  {errors.hamlet && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.76rem', marginTop: 4, fontWeight: 600 }}>{errors.hamlet}</div>}
                </div>
              </div>

              <div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Vùng miền *</label>
                  <select className="form-select" style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4 }} value={formData.region} onChange={(e) => handleRegionChange(e.target.value as Region)}>
                    <option value="Miền Bắc">Miền Bắc</option>
                    <option value="Miền Trung">Miền Trung</option>
                    <option value="Miền Nam">Miền Nam</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Thành phố / Tỉnh *</label>
                  <select className="form-select" style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4 }} value={formData.province} onChange={(e) => handleProvinceChange(e.target.value)}>
                    {(VIETNAM_ADMINISTRATIVE_DATA[formData.region] || []).map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Phường / Xã / Huyện *</label>
                  <select
                    className="form-select"
                    style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4 }}
                    value={isCustomWard ? 'CUSTOM_WARD_OPTION' : formData.district}
                    onChange={(e) => handleWardSelect(e.target.value)}
                  >
                    {((VIETNAM_ADMINISTRATIVE_DATA[formData.region] || []).find((p) => p.name === formData.province)?.wards || []).map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                    <option value="CUSTOM_WARD_OPTION">+ Thêm Phường / Xã khác...</option>
                  </select>
                  {errors.district && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.76rem', marginTop: 4, fontWeight: 600 }}>{errors.district}</div>}
                </div>

                {isCustomWard && (
                  <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4 }}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                style={{ padding: '10px 26px', fontSize: '0.92rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 4 }}
              >
                Tiếp theo: Thông số kỹ thuật &amp; Mùa leo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2 ================= */}
        {step === 2 && (
          <div className="card" style={{ padding: '24px 26px', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <IconMountain size={22} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.12rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
                Bước 2: Thông Số Kỹ Thuật &amp; Lịch Mùa Trekking 12 Tháng
              </h3>
            </div>

            <div className="wizard-grid-2">
              <div>
                <div className="wizard-grid-3" style={{ marginBottom: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Cự ly (km) *</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      style={{ padding: '9px 12px', fontSize: '0.88rem', borderRadius: 4, borderColor: errors.distanceKm ? 'var(--color-error)' : undefined }}
                      value={formData.distanceKm}
                      onChange={(e) => handleChange('distanceKm', Number(e.target.value))}
                    />
                    {errors.distanceKm && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.72rem', marginTop: 2 }}>{errors.distanceKm}</div>}
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Độ dốc (+m) *</label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '9px 12px', fontSize: '0.88rem', borderRadius: 4, borderColor: errors.elevationGainM ? 'var(--color-error)' : undefined }}
                      value={formData.elevationGainM}
                      onChange={(e) => handleChange('elevationGainM', Number(e.target.value))}
                    />
                    {errors.elevationGainM && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.72rem', marginTop: 2 }}>{errors.elevationGainM}</div>}
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Cao độ đỉnh (m) *</label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '9px 12px', fontSize: '0.88rem', borderRadius: 4, borderColor: errors.maxAltitudeM ? 'var(--color-error)' : undefined }}
                      value={formData.maxAltitudeM}
                      onChange={(e) => handleChange('maxAltitudeM', Number(e.target.value))}
                    />
                    {errors.maxAltitudeM && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.72rem', marginTop: 2 }}>{errors.maxAltitudeM}</div>}
                  </div>
                </div>

                {/* Responsive 2-col grid on mobile */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Thời gian đi *</label>
                    <select
                      className="form-select"
                      style={{ padding: '9px 12px', fontSize: '0.88rem', borderRadius: 4 }}
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
                    <select className="form-select" style={{ padding: '9px 12px', fontSize: '0.88rem', borderRadius: 4 }} value={formData.difficultyLevel} onChange={(e) => handleChange('difficultyLevel', Number(e.target.value))}>
                      <option value={1}>1/5 - Rất dễ (Người mới)</option>
                      <option value={2}>2/5 - Dễ (Gia đình)</option>
                      <option value={3}>3/5 - Trung bình (Thể lực tốt)</option>
                      <option value={4}>4/5 - Thử thách (Dốc đứng)</option>
                      <option value={5}>5/5 - Khắc nghiệt (Chuyên nghiệp)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>Ghi chú địa hình &amp; độ khó</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '9px 12px', fontSize: '0.88rem', borderRadius: 4 }}
                    placeholder="Ví dụ: Vách đá dốc, rừng trúc trơn trượt, qua lán 2800m..."
                    value={formData.difficultyNote}
                    onChange={(e) => handleChange('difficultyNote', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCalendar size={15} color="var(--color-primary)" /> Lịch 12 Tháng Trekking *
                  </label>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} />
                      Mùa lý tưởng
                    </span>
                    <span style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--color-error)', display: 'inline-block' }} />
                      Tránh mưa bão
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: 12 }}>
                  Nhấp vào từng tháng để chuyển đổi: <strong>Lý tưởng</strong> → <strong>Nên tránh</strong> → <strong>Bình thường</strong>
                </div>

                <div className="wizard-months-grid">
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
                          borderRadius: 4,
                          border: isBest
                            ? '1.5px solid var(--color-primary)'
                            : isAvoid
                              ? '1.5px solid var(--color-error)'
                              : '1px solid var(--color-border)',
                          background: isBest
                            ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                            : isAvoid
                              ? 'color-mix(in srgb, var(--color-error) 15%, transparent)'
                              : 'var(--color-bg-card)',
                          color: isBest ? 'var(--color-primary)' : isAvoid ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-dim)',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <span>T{m}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 14 }}>
                          {isBest ? <IconCheck size={12} color="var(--color-primary)" /> : isAvoid ? <IconX size={12} color="var(--color-error-text, var(--color-error))" /> : '–'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.bestMonths && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.76rem', marginTop: 6, fontWeight: 600 }}>{errors.bestMonths}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} style={{ padding: '10px 22px', fontSize: '0.88rem', borderRadius: 4 }}>
                <ArrowLeft size={16} /> Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                style={{ padding: '10px 26px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 4 }}
              >
                Tiếp theo: Bản đồ &amp; Tọa độ GPS <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: GPS MAP, GPX TRACK & WAYPOINTS EDITOR ================= */}
        {step === 3 && (
          <div className="card" style={{ padding: '24px 26px', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconMapPin size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: 700, margin: 0 }}>
                  Bước 3: Đánh Dấu Tọa Độ GPS, Tracklog GPX &amp; Mốc Tọa Độ
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPinMode('start')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: pinMode === 'start' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: pinMode === 'start' ? 'var(--color-primary)' : 'var(--color-bg-main)',
                    color: pinMode === 'start' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  1. Ghim Xuất Phát
                </button>
                <button
                  type="button"
                  onClick={() => setPinMode('end')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: pinMode === 'end' ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                    background: pinMode === 'end' ? 'var(--color-error)' : 'var(--color-bg-main)',
                    color: pinMode === 'end' ? 'var(--color-on-danger)' : 'var(--color-text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  2. Ghim Đích / Đỉnh
                </button>
                <button
                  type="button"
                  onClick={() => setPinMode('waypoint')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: pinMode === 'waypoint' ? '1px solid var(--color-sky)' : '1px solid var(--color-border)',
                    background: pinMode === 'waypoint' ? 'var(--color-sky)' : 'var(--color-bg-main)',
                    color: pinMode === 'waypoint' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  3. Ghim Mốc Tọa Độ
                </button>
                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.78rem', padding: '5px 10px', height: 32, borderRadius: 4 }}
                  value={mapTileType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setMapTileType(e.target.value as 'satellite' | 'terrain' | 'osm')
                  }
                >
                  <option value="satellite">Vệ Tinh (Esri World)</option>
                  <option value="terrain">Địa Hình (Topo)</option>
                  <option value="osm">Bản Đồ Phố</option>
                </select>
              </div>
            </div>

            <div className="wizard-grid-2-wide" style={{ alignItems: 'start' }}>
              {/* Map Canvas & GPX Upload */}
              <div>
                <div style={{ height: 310, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 12, position: 'relative' }}>
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
                    <MapBoundsFitter
                      gpxTrack={gpxTrack}
                      start={[formData.startLat, formData.startLng]}
                      end={[formData.endLat, formData.endLng]}
                      fitVersion={mapFitVersion}
                    />
                    <MapClickListener
                      onSelectCoords={(lat, lng) => {
                        if (pinMode === 'start') {
                          setFormData((prev) => ({ ...prev, startLat: lat, startLng: lng }));
                        } else if (pinMode === 'end') {
                          setFormData((prev) => ({ ...prev, endLat: lat, endLng: lng }));
                        } else {
                          setWpLat(String(lat));
                          setWpLng(String(lng));
                        }
                      }}
                    />
                    <Marker position={[formData.startLat, formData.startLng]} icon={greenPinIcon}>
                      <Popup>Xuất phát: {formData.startLat}, {formData.startLng}</Popup>
                    </Marker>
                    <Marker position={[formData.endLat, formData.endLng]} icon={redPinIcon}>
                      <Popup>Đích / Đỉnh: {formData.endLat}, {formData.endLng}</Popup>
                    </Marker>
                    {formData.waypoints.map((wp) => (
                      <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={bluePinIcon}>
                        <Popup>
                          <strong>{wp.name}</strong> ({WAYPOINT_TYPE_LABELS[wp.type] || wp.type})
                          {wp.elevationM ? ` • ${wp.elevationM}m` : ''}
                        </Popup>
                      </Marker>
                    ))}
                    <Polyline
                      positions={
                        gpxTrack.length > 0
                          ? gpxTrack
                          : [
                              [formData.startLat, formData.startLng],
                              [formData.endLat, formData.endLng],
                            ]
                      }
                      color="#1f6f4a"
                      weight={4}
                    />
                  </MapContainer>
                </div>

                {/* GPX Upload Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: '9px 14px', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                    Tệp GPX Tuyến Đường{gpxTrack.length > 0 ? ` (${gpxTrack.length} điểm)` : ''}:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label htmlFor="gpx-file-upload-input" className="btn btn-outline" style={{ padding: '5px 14px', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, height: 28, display: 'inline-flex', alignItems: 'center' }}>
                      Tải tệp .gpx
                    </label>
                    <span style={{ fontSize: '0.78rem', color: gpxFileName ? 'var(--color-primary)' : 'var(--color-text-dim)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {gpxFileName || 'Chưa chọn tệp'}
                    </span>
                    <input id="gpx-file-upload-input" type="file" accept=".gpx" onChange={handleGpxUpload} style={{ display: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Coordinates Fields, Waypoints Editor & Tips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 6 }}>1. Tọa độ Xuất Phát</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 6 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vĩ độ (Lat)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.startLat} onChange={(e) => handleChange('startLat', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Kinh độ (Lng)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.startLng} onChange={(e) => handleChange('startLng', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-error-text, var(--color-error))', marginBottom: 6 }}>2. Tọa độ Đích / Đỉnh</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 6 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vĩ độ (Lat)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.endLat} onChange={(e) => handleChange('endLat', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Kinh độ (Lng)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.endLng} onChange={(e) => handleChange('endLng', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                </div>
                {(errors.startLat || errors.startLng || errors.endLat || errors.endLng) && (
                  <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.75rem', fontWeight: 600 }}>
                    {errors.startLat || errors.startLng || errors.endLat || errors.endLng}
                  </div>
                )}

                {/* Optional Waypoints Editor */}
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-sky)' }}>
                      Mốc Tọa Độ Thực Địa (Tùy chọn • {formData.waypoints.length})
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                      Chọn &ldquo;3. Ghim Mốc&rdquo; rồi bấm bản đồ để lấy Lat/Lng
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6, marginBottom: 6 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Tên mốc (VD: Lán 2.400m)"
                      value={wpName}
                      onChange={(e) => setWpName(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                    <select
                      className="form-select"
                      value={wpType}
                      onChange={(e) => setWpType(e.target.value as Waypoint['type'])}
                      style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    >
                      {Object.entries(WAYPOINT_TYPE_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>{lbl}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Cao độ (m)"
                      value={wpElevation}
                      onChange={(e) => setWpElevation(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, marginBottom: 8 }}>
                    <input
                      type="number"
                      step="0.00001"
                      className="form-input"
                      placeholder="Lat mốc"
                      value={wpLat}
                      onChange={(e) => setWpLat(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                    <input
                      type="number"
                      step="0.00001"
                      className="form-input"
                      placeholder="Lng mốc"
                      value={wpLng}
                      onChange={(e) => setWpLng(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ghi chú ngắn..."
                      value={wpDesc}
                      onChange={(e) => setWpDesc(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddWaypoint}
                      className="btn btn-outline"
                      style={{ padding: '6px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <IconPlus size={13} color="var(--color-primary)" /> Thêm Mốc
                    </button>
                  </div>

                  {formData.waypoints.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
                      {formData.waypoints.map((wp) => (
                        <div
                          key={wp.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '5px 8px',
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 4,
                            fontSize: '0.74rem',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ color: 'var(--color-text-main)' }}>{wp.name}</strong>
                            <span style={{ color: 'var(--color-text-dim)', marginLeft: 6 }}>
                              {WAYPOINT_TYPE_LABELS[wp.type] || wp.type}
                              {wp.elevationM ? ` • ${wp.elevationM}m` : ''} ({wp.lat}, {wp.lng})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveWaypoint(wp.id)}
                            aria-label={`Xóa mốc ${wp.name}`}
                            style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--color-error))', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12, fontSize: '0.76rem', color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconLightbulb size={15} color="var(--color-sun)" /> Hướng Dẫn Tọa Độ Thực Địa
                  </div>
                  <div>• Nhấp trực tiếp vào bản đồ vệ tinh để cập nhật tọa độ xuất phát, đỉnh hoặc mốc dọc đường.</div>
                  <div>• Tải tệp <code>.gpx</code> sẽ tự động tính cự ly (km), cao độ đỉnh, độ dốc tích lũy và căn khung bản đồ.</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)} style={{ padding: '10px 22px', fontSize: '0.88rem', borderRadius: 4 }}>
                <ArrowLeft size={16} /> Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (validateStep3()) setStep(4);
                }}
                style={{ padding: '10px 26px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 4 }}
              >
                Tiếp theo: Tiện ích &amp; Cứu hộ <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4 ================= */}
        {step === 4 && (
          <div className="card" style={{ padding: '24px 26px', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <IconShieldCheck size={22} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.12rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
                Bước 4: Tiện Ích, Giấy Phép, Hotline Cứu Hộ &amp; Ảnh Thực Địa
              </h3>
            </div>

            <div className="wizard-grid-2">
              <div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>Ảnh bìa thực địa *</label>
                    <label htmlFor="cover-file-input" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.76rem', height: 28, cursor: 'pointer', borderRadius: 4 }}>
                      {uploadingImage ? 'Đang tải...' : 'Tải ảnh từ máy'}
                    </label>
                    <input id="cover-file-input" type="file" accept="image/*" disabled={uploadingImage} onChange={handleCoverImageUpload} style={{ display: 'none' }} />
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, borderColor: errors.coverImage ? 'var(--color-error)' : undefined }}
                    placeholder="https://res.cloudinary.com/... hoặc dán link ảnh thực tế của bạn"
                    value={formData.coverImage}
                    onChange={(e) => handleChange('coverImage', e.target.value)}
                  />
                  {errors.coverImage && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.74rem', marginTop: 2 }}>{errors.coverImage}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>Mô tả tổng quan cung đường *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, borderColor: errors.description ? 'var(--color-error)' : undefined }}
                    placeholder="Mô tả về đặc trưng cảnh quan, thảm thực vật, mốc thời gian..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                  {errors.description && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.74rem', marginTop: 2 }}>{errors.description}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>Hướng dẫn di chuyển đến chân núi *</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, borderColor: errors.transportationInfo ? 'var(--color-error)' : undefined }}
                    placeholder="Lộ trình xe khách giường nằm, xe ôm vào bản, điểm gửi xe..."
                    value={formData.transportationInfo}
                    onChange={(e) => handleChange('transportationInfo', e.target.value)}
                  />
                  {errors.transportationInfo && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.74rem', marginTop: 2 }}>{errors.transportationInfo}</div>}
                </div>
              </div>

              <div>
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-sun)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconAlertTriangle size={15} color="var(--color-sun)" /> Cứu Hộ &amp; Kiểm Lâm Địa Bàn (Thực Tế) *
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Đơn vị phụ trách / VQG</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                        value={formData.rescueContact.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rescueContact: { ...prev.rescueContact, name: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Số hotline cứu hộ *</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4, borderColor: errors.rescuePhone ? 'var(--color-error)' : undefined }}
                        placeholder="112 / 114 / 02143.871.494"
                        value={formData.rescueContact.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rescueContact: { ...prev.rescueContact, phone: e.target.value } }))}
                      />
                      {errors.rescuePhone && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.72rem', marginTop: 2 }}>{errors.rescuePhone}</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Trạm kiểm lâm cửa rừng</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                      value={formData.rescueContact.rangerContact}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rescueContact: { ...prev.rescueContact, rangerContact: e.target.value } }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={formData.permitRequired} onChange={(e) => handleChange('permitRequired', e.target.checked)} />
                    <span>Cần giấy phép VQG</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={formData.hasCampsite} onChange={(e) => handleChange('hasCampsite', e.target.checked)} />
                    <span>Có bãi cắm trại</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={formData.hasWaterSource} onChange={(e) => handleChange('hasWaterSource', e.target.checked)} />
                    <span>Có nguồn nước</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--color-bg-main)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={formData.kidFriendly} onChange={(e) => handleChange('kidFriendly', e.target.checked)} />
                    <span>Phù hợp trẻ em</span>
                  </label>
                </div>

                {formData.permitRequired && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4, borderColor: errors.permitInfo ? 'var(--color-error)' : undefined }}
                      placeholder="Nhập tên nơi cấp phép (VD: BQL VQG Hoàng Liên, vé VQG 70k + phí leo 150k)"
                      value={formData.permitInfo}
                      onChange={(e) => handleChange('permitInfo', e.target.value)}
                    />
                    {errors.permitInfo && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.72rem', marginTop: 2 }}>{errors.permitInfo}</div>}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(3)} style={{ padding: '10px 22px', fontSize: '0.88rem', borderRadius: 4 }}>
                <ArrowLeft size={16} /> Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (validateStep4()) setStep(5);
                }}
                style={{ padding: '10px 26px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 4 }}
              >
                Xem trước bài đóng góp <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: LIVE HUD PREVIEW & SUBMIT ================= */}
        {step === 5 && (
          <div className="card" style={{ padding: '24px 26px', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    referrerPolicy="no-referrer"
                    style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid var(--color-primary)', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                      border: '1.5px solid var(--color-primary)',
                      color: 'var(--color-primary)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  {userName}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>• +50 điểm uy tín khi Ban Quản Trị duyệt</span>
              </div>
              <span className="badge badge-sun">
                <IconClock size={12} color="var(--color-sun)" /> Chờ Ban Quản Trị Duyệt
              </span>
            </div>

            <div className="wizard-grid-2-wide" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 18, marginBottom: 20 }}>
              <div>
                {formData.coverImage && (
                  <div style={{ height: 165, borderRadius: 4, overflow: 'hidden', marginBottom: 12, position: 'relative', border: '1px solid var(--color-border)' }}>
                    <img src={formData.coverImage} alt={formData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 8, left: 10, background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 4 }}>
                      {formData.region} · {formData.province}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>{formData.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 8 }}>
                  Xuất phát: <strong>{formData.hamlet}</strong>, {formData.district}, {formData.province}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5, maxHeight: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formData.description}
                </div>
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 4, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>Cự ly</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>{formData.distanceKm}km</div>
                  </div>
                  <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 4, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>Cao độ</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums' }}>{formData.maxAltitudeM}m</div>
                  </div>
                  <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 4, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>Độ dốc</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>+{formData.elevationGainM}m</div>
                  </div>
                  <div style={{ background: 'var(--color-bg-card)', padding: '8px 6px', borderRadius: 4, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>Độ khó</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>{formData.difficultyLevel}/5</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                  Mùa leo núi lý tưởng:
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {formData.bestMonths.map((m) => (
                    <span key={m} className="badge badge-success">
                      Tháng {m}
                    </span>
                  ))}
                </div>

                {formData.waypoints.length > 0 && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-sky)', fontWeight: 700, marginBottom: 8 }}>
                    Đã gắn {formData.waypoints.length} mốc tọa độ dọc đường
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                  Hotline cứu hộ: <strong style={{ color: 'var(--color-text-main)' }}>{formData.rescueContact.phone || '112 / 114'}</strong> ({formData.rescueContact.name})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(4)} style={{ padding: '10px 22px', fontSize: '0.88rem', borderRadius: 4 }}>
                <ArrowLeft size={16} /> Sửa thông tin
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
                style={{ flex: 1, minWidth: 220, padding: '10px 28px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 4 }}
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
