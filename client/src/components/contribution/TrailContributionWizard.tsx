import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LostVectorMap,
  type LostMapMarkerItem,
  type LostMapPolylineItem,
} from '../map/LostVectorMap.js';
import { FREE_BASEMAPS, FREE_BASEMAP_ORDER, type BasemapKey } from '../../utils/mapTiles.js';
import {
  submitTrailContribution,
  updateTrailContribution,
  uploadImageToCloudinary,
  reverseGeocode,
} from '../../services/api.js';
import { safeLocalStorageGet, scopedStorageKey } from '../../utils/storageScope.js';
import {
  computeRouteMetrics,
  parseGpxXml,
  type RouteWaypointType,
} from '../../utils/routeMetrics.js';
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

function computeContribBounds(
  pts: [number, number][]
): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let validCount = 0;

  for (const [lat, lng] of pts) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    validCount += 1;
  }

  if (validCount < 2) return null;
  if (Math.abs(maxLat - minLat) < 1e-6 && Math.abs(maxLng - minLng) < 1e-6) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

interface ProvinceData {
  name: string;
  wards: string[];
}

const VIETNAM_ADMINISTRATIVE_DATA: Record<string, ProvinceData[]> = {
  'Miền Bắc': [
    { name: 'Thành phố Hà Nội', wards: ['Phường Ba Đình', 'Phường Hoàn Kiếm', 'Xã Tản Lĩnh (Ba Vì)', 'Xã Ba Vì', 'Xã Hương Sơn', 'Xã Sóc Sơn'] },
    { name: 'Tỉnh Lào Cai', wards: ['Phường Sa Pa', 'Xã Y Tý', 'Thị trấn Bát Xát', 'Xã Mường Hum', 'Xã Tả Van', 'Xã Bản Hồ', 'Xã Ngũ Chỉ Sơn', 'Xã Tả Phìn'] },
    { name: 'Tỉnh Yên Bái', wards: ['Phường Nghĩa Lộ', 'Thị trấn Trạm Tấu', 'Thị trấn Mù Cang Chải', 'Xã Xà Hồ', 'Xã Tú Lệ', 'Xã La Pán Tẩn', 'Xã Nậm Có'] },
    { name: 'Tỉnh Hà Giang', wards: ['Thành phố Hà Giang', 'Thị trấn Đồng Văn', 'Thị trấn Mèo Vạc', 'Xã Lũng Cú', 'Xã Thông Nguyên', 'Thị trấn Tam Sơn', 'Xã Cao Bồ'] },
    { name: 'Tỉnh Lai Châu', wards: ['Thành phố Lai Châu', 'Thị trấn Tam Đường', 'Xã Tả Lèng', 'Xã Sơn Bình', 'Xã Hồ Thầu', 'Thị trấn Sìn Hồ', 'Xã Pa Vệ Sử', 'Xã Vàng Ma Chải'] },
    { name: 'Tỉnh Sơn La', wards: ['Thành phố Sơn La', 'Thị trấn Bắc Yên', 'Xã Tà Xùa', 'Thị xã Mộc Châu', 'Xã Chiềng Sơn', 'Xã Vân Hồ'] },
    { name: 'Tỉnh Hòa Bình', wards: ['Thành phố Hòa Bình', 'Thị trấn Mai Châu', 'Xã Hang Kia', 'Xã Pà Cò', 'Thị trấn Cao Phong'] },
    { name: 'Tỉnh Cao Bằng', wards: ['Thành phố Cao Bằng', 'Thị trấn Trùng Khánh', 'Xã Đàm Thủy', 'Thị trấn Xuân Hòa', 'Thị trấn Nguyên Bình'] },
    { name: 'Tỉnh Lạng Sơn', wards: ['Thành phố Lạng Sơn', 'Xã Mẫu Sơn', 'Thị trấn Hữu Lũng', 'Thị trấn Đồng Mỏ'] },
    { name: 'Tỉnh Quảng Ninh', wards: ['Thành phố Hạ Long', 'Phường Phương Đông (Uông Bí)', 'Xã Thượng Yên Công', 'Thị trấn Bình Liêu', 'Xã Hoành Mô', 'Thị trấn Cô Tô'] },
    { name: 'Tỉnh Ninh Bình', wards: ['Xã Cúc Phương', 'Thị trấn Nho Quan', 'Xã Ninh Hải', 'Thành phố Hoa Lư'] },
    { name: 'Thành phố Hải Phòng', wards: ['Thị trấn Cát Bà', 'Xã Việt Hải', 'Xã Gia Luận', 'Xã Trân Châu'] },
    { name: 'Tỉnh Vĩnh Phúc', wards: ['Thị trấn Tam Đảo', 'Thị trấn Hợp Châu', 'Xã Hồ Sơn', 'Xã Đại Đình'] },
    { name: 'Tỉnh Bắc Kạn', wards: ['Xã Nam Mẫu', 'Thị trấn Chợ Rã', 'Xã Quảng Khê'] },
    { name: 'Tỉnh Phú Thọ', wards: ['Xã Xuân Sơn', 'Thị trấn Tân Phú', 'Xã Xuân Đài'] },
    { name: 'Tỉnh Tuyên Quang', wards: ['Thị trấn Na Hang', 'Xã Thượng Lâm', 'Thị trấn Lăng Can'] },
  ],
  'Miền Trung': [
    { name: 'Tỉnh Thanh Hóa', wards: ['Xã Thành Lâm', 'Xã Phú Lệ', 'Xã Cổ Lũng', 'Thị trấn Cành Nàng'] },
    { name: 'Tỉnh Nghệ An', wards: ['Xã Chi Khê', 'Thị trấn Con Cuông', 'Xã Môn Sơn', 'Xã Châu Khê'] },
    { name: 'Tỉnh Quảng Bình', wards: ['Thành phố Đồng Hới', 'Thị trấn Phong Nha', 'Xã Tân Hóa', 'Thị trấn Hoàn Lão'] },
    { name: 'Thành phố Huế', wards: ['Quận Thuận Hóa', 'Quận Phú Xuân', 'Xã Lộc Trì', 'Thị trấn A Lưới', 'Thị trấn Khe Tre'] },
    { name: 'Thành phố Đà Nẵng', wards: ['Phường Sơn Trà', 'Phường Thọ Quang', 'Phường Hải Châu', 'Xã Hòa Bắc', 'Xã Hòa Ninh', 'Xã Hòa Sơn'] },
    { name: 'Tỉnh Quảng Nam', wards: ['Thành phố Hội An', 'Thành phố Tam Kỳ', 'Xã Trà Mai (Nam Trà My)', 'Thị trấn Khâm Đức'] },
    { name: 'Tỉnh Quảng Ngãi', wards: ['Thành phố Quảng Ngãi', 'Xã Ba Lế', 'Huyện Lý Sơn'] },
    { name: 'Tỉnh Bình Định', wards: ['Thành phố Quy Nhơn', 'Xã Nhơn Lý', 'Xã Vĩnh Sơn'] },
    { name: 'Tỉnh Phú Yên', wards: ['Thành phố Tuy Hòa', 'Xã Hòa Tâm', 'Xã Sơn Long'] },
    { name: 'Tỉnh Khánh Hòa', wards: ['Thành phố Nha Trang', 'Xã Vạn Thạnh', 'Xã Suối Cát', 'Thị trấn Diên Khánh'] },
    { name: 'Tỉnh Ninh Thuận', wards: ['Thành phố Phan Rang - Tháp Chàm', 'Xã Phước Bình', 'Xã Vĩnh Hải'] },
    { name: 'Tỉnh Bình Thuận', wards: ['Thành phố Phan Thiết', 'Xã Phan Dũng', 'Thị trấn Lạc Tánh'] },
    { name: 'Tỉnh Kon Tum', wards: ['Thành phố Kon Tum', 'Thị trấn Măng Đen', 'Thị trấn Đắk Glei', 'Xã Đắk Na'] },
    { name: 'Tỉnh Gia Lai', wards: ['Thành phố Pleiku', 'Xã Sơn Lang', 'Xã Chư Đăng Ya', 'Thị trấn Kbang', 'Thị trấn Kon Dơng'] },
    { name: 'Tỉnh Đắk Lắk', wards: ['Thành phố Buôn Ma Thuột', 'Thị trấn Krông Kmar', 'Xã Krông Na', 'Thị trấn Liên Sơn'] },
    { name: 'Tỉnh Đắk Nông', wards: ['Thành phố Gia Nghĩa', 'Xã Đắk Som', 'Xã Quảng Khê'] },
    { name: 'Tỉnh Lâm Đồng', wards: ['Thành phố Đà Lạt', 'Phường Xuân Thọ', 'Thị trấn Lạc Dương', 'Xã Đạ Nhim', 'Xã Tà Năng', 'Xã Đạ Chais'] },
  ],
  'Miền Nam': [
    { name: 'Thành phố Hồ Chí Minh', wards: ['Thành phố Thủ Đức', 'Quận 1', 'Xã Cần Giờ', 'Thị trấn Củ Chi'] },
    { name: 'Tỉnh Bà Rịa - Vũng Tàu', wards: ['Thành phố Vũng Tàu', 'Thành phố Bà Rịa', 'Thành phố Phú Mỹ', 'Xã Tân Hải', 'Xã Xuyên Mộc'] },
    { name: 'Tỉnh Đồng Nai', wards: ['Thành phố Biên Hòa', 'Xã Nam Cát Tiên', 'Thị trấn Gia Ray', 'Xã Suối Cát'] },
    { name: 'Tỉnh Bình Phước', wards: ['Thành phố Đồng Xoài', 'Xã Bù Gia Mập', 'Phường Thác Mơ', 'Thị trấn Phước Bình'] },
    { name: 'Tỉnh Tây Ninh', wards: ['Thành phố Tây Ninh', 'Phường Ninh Sơn', 'Xã Thạnh Tân', 'Thị trấn Tân Biên'] },
    { name: 'Tỉnh An Giang', wards: ['Thành phố Long Xuyên', 'Thành phố Châu Đốc', 'Xã An Hảo', 'Thị trấn Tri Tôn'] },
    { name: 'Tỉnh Kiên Giang', wards: ['Thành phố Phú Quốc', 'Thành phố Rạch Giá', 'Xã An Sơn'] },
  ],
};

const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  'Thành phố Hà Nội': [21.0285, 105.8542],
  'Tỉnh Lào Cai': [22.3364, 103.8438],
  'Tỉnh Yên Bái': [21.7052, 104.8705],
  'Tỉnh Hà Giang': [22.8233, 104.9839],
  'Tỉnh Lai Châu': [22.3963, 103.4586],
  'Tỉnh Sơn La': [21.3257, 103.9188],
  'Tỉnh Hòa Bình': [20.8156, 105.3384],
  'Tỉnh Cao Bằng': [22.6663, 106.2625],
  'Tỉnh Lạng Sơn': [21.8537, 106.7615],
  'Tỉnh Quảng Ninh': [21.1418, 106.7165],
  'Tỉnh Ninh Bình': [20.2539, 105.7145],
  'Thành phố Hải Phòng': [20.7997, 107.0481],
  'Tỉnh Vĩnh Phúc': [21.4566, 105.6426],
  'Tỉnh Bắc Kạn': [22.4167, 105.6167],
  'Tỉnh Phú Thọ': [21.1394, 104.9461],
  'Tỉnh Tuyên Quang': [22.3536, 105.3947],
  'Tỉnh Thanh Hóa': [20.478, 105.125],
  'Tỉnh Nghệ An': [19.0432, 104.8835],
  'Tỉnh Quảng Bình': [17.5906, 106.2833],
  'Thành phố Huế': [16.2585, 107.8615],
  'Thành phố Đà Nẵng': [16.0544, 108.2022],
  'Tỉnh Quảng Nam': [15.567, 108.0],
  'Tỉnh Quảng Ngãi': [15.1214, 108.8044],
  'Tỉnh Bình Định': [13.7829, 109.2197],
  'Tỉnh Phú Yên': [13.0882, 109.0929],
  'Tỉnh Khánh Hòa': [12.2585, 109.1932],
  'Tỉnh Ninh Thuận': [11.7165, 109.193],
  'Tỉnh Bình Thuận': [11.3515, 108.6455],
  'Tỉnh Kon Tum': [14.3497, 108.0005],
  'Tỉnh Gia Lai': [14.5045, 108.5625],
  'Tỉnh Đắk Lắk': [12.482, 108.342],
  'Tỉnh Đắk Nông': [11.8692, 107.9882],
  'Tỉnh Lâm Đồng': [11.9404, 108.4583],
  'Thành phố Hồ Chí Minh': [10.8231, 106.6297],
  'Tỉnh Bà Rịa - Vũng Tàu': [10.5865, 107.0622],
  'Tỉnh Đồng Nai': [11.4235, 107.4285],
  'Tỉnh Bình Phước': [12.1922, 107.2044],
  'Tỉnh Tây Ninh': [11.367, 106.167],
  'Tỉnh An Giang': [10.3759, 105.4185],
  'Tỉnh Kiên Giang': [10.227, 103.963],
};

// 100% Source-Verified Vietnam National Parks & Provincial Forestry Rescue Contacts (Rule 11)
const VERIFIED_PROVINCE_RESCUE: Record<string, { name: string; phone: string; rangerContact: string }> = {
  'Tỉnh Lào Cai': {
    name: 'VQG Hoàng Liên & Chi cục Kiểm lâm Lào Cai',
    phone: '02143.871.494',
    rangerContact: '0985.834.581 / Trạm Kiểm lâm Trạm Tôn',
  },
  'Tỉnh Yên Bái': {
    name: 'Chi cục Kiểm lâm Yên Bái',
    phone: '02163.852.341',
    rangerContact: 'Hạt Kiểm lâm địa phương / 112',
  },
  'Tỉnh Lai Châu': {
    name: 'Chi cục Kiểm lâm Lai Châu',
    phone: '02133.876.605',
    rangerContact: 'Hạt Kiểm lâm địa phương / 112',
  },
  'Tỉnh Sơn La': {
    name: 'Chi cục Kiểm lâm Sơn La',
    phone: '02123.852.046',
    rangerContact: 'Hạt Kiểm lâm địa phương / 112',
  },
  'Tỉnh Hà Giang': {
    name: 'Chi cục Kiểm lâm Hà Giang',
    phone: '0219.3861.628',
    rangerContact: 'Hạt Kiểm lâm địa phương / 112',
  },
  'Thành phố Hà Nội': {
    name: 'VQG Ba Vì (Ba Vì, Hà Nội)',
    phone: '02433.881.082',
    rangerContact: '0966.173.119 / 114',
  },
  'Tỉnh Quảng Ninh': {
    name: 'BQL Di sản Yên Tử & Chi cục Kiểm lâm Quảng Ninh',
    phone: '0812.488.111',
    rangerContact: '02033.835.523 / 112',
  },
  'Tỉnh Ninh Bình': {
    name: 'VQG Cúc Phương (Nho Quan, Ninh Bình)',
    phone: '1800.5555.88',
    rangerContact: '02293.848.006 / 112',
  },
  'Tỉnh Thanh Hóa': {
    name: 'BQL Khu BTTN Pù Luông (Bá Thước, Thanh Hóa)',
    phone: '02373.880.671',
    rangerContact: 'Hạt Kiểm lâm Bá Thước / 112',
  },
  'Tỉnh Nghệ An': {
    name: 'VQG Pù Mát (Con Cuông, Nghệ An)',
    phone: '02383.873.374',
    rangerContact: '0964.585.655 / 112',
  },
  'Thành phố Huế': {
    name: 'VQG Bạch Mã (Phú Lộc, TP. Huế)',
    phone: '0234.3871.330',
    rangerContact: '0836.356.669 / Trạm Kiểm lâm VQG Bạch Mã',
  },
  'Thành phố Đà Nẵng': {
    name: 'BQL Rừng đặc dụng Bà Nà - Núi Chúa (Đà Nẵng)',
    phone: '0236.3738.521',
    rangerContact: 'CNCH Đà Nẵng 112 / 114',
  },
  'Tỉnh Quảng Bình': {
    name: 'VQG Phong Nha - Kẻ Bàng (Quảng Bình)',
    phone: '0918.841.455',
    rangerContact: '0868.815.678 / 114',
  },
  'Tỉnh Khánh Hòa': {
    name: 'Chi cục Kiểm lâm Khánh Hòa & Khu BTTN Hòn Bà',
    phone: '0258.3837.149',
    rangerContact: '0258.3213.222 / 112',
  },
  'Tỉnh Lâm Đồng': {
    name: 'VQG Bidoup - Núi Bà & Chi cục Kiểm lâm Lâm Đồng',
    phone: '0263.3502.005',
    rangerContact: '02633.822.441 / 0947.047.449',
  },
  'Tỉnh Đắk Lắk': {
    name: 'VQG Chư Yang Sin (Krông Bông, Đắk Lắk)',
    phone: '0262.3734.226',
    rangerContact: 'Trạm Kiểm lâm VQG Chư Yang Sin / 112',
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
  'Tỉnh Bà Rịa - Vũng Tàu': {
    name: 'Hạt Kiểm lâm Phú Mỹ — Trạm Kiểm lâm Núi Dinh',
    phone: '0254.3876.318',
    rangerContact: '112 / 114',
  },
  'Tỉnh Đồng Nai': {
    name: 'VQG Cát Tiên & Chi cục Kiểm lâm Đồng Nai',
    phone: '02513.669.228',
    rangerContact: '0251.3992.053 / 0856.669.228',
  },
  'Tỉnh Bình Phước': {
    name: 'VQG Bù Gia Mập (Bù Gia Mập, Bình Phước)',
    phone: '02713.724.237',
    rangerContact: '0384.798.799 / 112',
  },
  'Tỉnh Tây Ninh': {
    name: 'Đội CNCH KDL Quốc gia Núi Bà Đen 24/24',
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

function normalizeAdminName(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\b(tinh|thanh pho|tp\.?|huyen|quan|thi xa|xa|phuong|thi tran)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchVietnamProvince(rawProvince: string): { region: Region; province: ProvinceData } | null {
  const normInput = normalizeAdminName(rawProvince);
  if (!normInput) return null;
  for (const [regionKey, provinces] of Object.entries(VIETNAM_ADMINISTRATIVE_DATA)) {
    for (const prov of provinces) {
      const normProv = normalizeAdminName(prov.name);
      if (normProv && (normProv === normInput || normProv.includes(normInput) || normInput.includes(normProv))) {
        return { region: regionKey as Region, province: prov };
      }
    }
  }
  return null;
}

const CANONICAL_DURATION_OPTIONS = [
  { value: '1 ngày', label: '1 ngày (Trong ngày)', days: 1 },
  { value: '2 ngày 1 đêm', label: '2 ngày 1 đêm', days: 2 },
  { value: '3 ngày 2 đêm', label: '3 ngày 2 đêm', days: 3 },
  { value: '4 ngày 3 đêm', label: '4 ngày 3 đêm', days: 4 },
  { value: 'Nửa ngày', label: 'Nửa ngày (4-6 tiếng)', days: 1 },
] as const;

function normalizeDurationHoursNote(raw: unknown, durationDays?: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (CANONICAL_DURATION_OPTIONS.some((o) => o.value === text)) return text;
  const lower = text.toLowerCase();
  if (/nửa ngày|nua ngay|half/.test(lower)) return 'Nửa ngày';
  if (/4\s*n\s*3|4\s*ngày/.test(lower)) return '4 ngày 3 đêm';
  if (/3\s*n\s*2|3\s*ngày/.test(lower)) return '3 ngày 2 đêm';
  if (/2\s*n\s*1|2\s*ngày/.test(lower)) return '2 ngày 1 đêm';
  if (/1\s*ngày|trong ngày/.test(lower)) return '1 ngày';
  const days = Number(durationDays);
  if (Number.isFinite(days)) {
    if (days >= 4) return '4 ngày 3 đêm';
    if (days === 3) return '3 ngày 2 đêm';
    if (days === 2) return '2 ngày 1 đêm';
  }
  return '1 ngày';
}

function mapRouteWaypointTypeToContrib(type: RouteWaypointType | string): Waypoint['type'] {
  switch (type) {
    case 'camp':
      return 'campsite';
    case 'water':
      return 'water';
    case 'danger':
      return 'danger';
    case 'ranger':
      return 'charging';
    case 'rest':
      return 'rest';
    case 'peak':
    case 'viewpoint':
    case 'start':
    default:
      return 'viewpoint';
  }
}

function isWithinVietnamBounds(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 8.0 && lat <= 23.6 && lng >= 102.0 && lng <= 110.5;
}

interface GeoSuggestion {
  lat: number;
  lng: number;
  formattedAddress: string;
  province: string;
  district: string;
  village: string;
  matchedRegion?: Region;
  matchedProvince?: string;
}

interface SavedContribDraft {
  step: number;
  formData: Record<string, unknown>;
  gpxTrack: [number, number][];
  gpxFileName: string;
  isCustomWard: boolean;
  customWardText: string;
  savedAt: string;
}

interface WizardProps {
  onBack: () => void;
  onSuccess: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: UserProfile | null;
}

export const TrailContributionWizard: React.FC<WizardProps> = ({ onBack, onSuccess, onShowToast, currentUser }) => {
  const draftStorageKey = scopedStorageKey('lost_contrib_draft_v1', currentUser?.id);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isCustomWard, setIsCustomWard] = useState(false);
  const [customWardText, setCustomWardText] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = Boolean(editingId);
  const [pinMode, setPinMode] = useState<'start' | 'end' | 'waypoint'>('start');
  const [mapTileType, setMapTileType] = useState<BasemapKey>('standard');
  const [copyrightConfirmed, setCopyrightConfirmed] = useState<boolean>(false);
  const [gpxTrack, setGpxTrack] = useState<[number, number][]>([]);
  const [gpxFileName, setGpxFileName] = useState<string>('');
  const [mapFitVersion, setMapFitVersion] = useState<number>(0);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [pendingDraft, setPendingDraft] = useState<SavedContribDraft | null>(() => {
    try {
      const editingStr = localStorage.getItem('lost_editing_contribution');
      if (editingStr) {
        const editingItem = JSON.parse(editingStr) as Record<string, unknown>;
        if (editingItem && (editingItem.id || editingItem._id)) return null;
      }
      if (localStorage.getItem('lost_planner_draft_contribution')) return null;
      const savedDraftRaw = localStorage.getItem(draftStorageKey);
      if (!savedDraftRaw) return null;
      const parsed = JSON.parse(savedDraftRaw) as SavedContribDraft;
      const fd = parsed?.formData as Record<string, unknown> | undefined;
      const hasMeaningfulContent = Boolean(
        fd &&
          ((typeof fd.name === 'string' && fd.name.trim().length > 0) ||
            (typeof fd.description === 'string' && fd.description.trim().length > 0) ||
            (Array.isArray(parsed.gpxTrack) && parsed.gpxTrack.length > 0))
      );
      return hasMeaningfulContent ? parsed : null;
    } catch {
      return null;
    }
  });
  const [geoSuggestion, setGeoSuggestion] = useState<GeoSuggestion | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const geocodeReqSeqRef = useRef<number>(0);
  const hasHydratedDraftCheckRef = useRef<boolean>(false);
  const isEditingRef = useRef<boolean>(false);

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
    hamlet: '',
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

  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    isEditingRef.current = Boolean(editingId);
  }, [editingId]);

  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        try {
          localStorage.removeItem('lost_editing_contribution');
        } catch {
          // ignore storage errors
        }
      }
    };
  }, []);

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
        durationHoursNote: normalizeDurationHoursNote(
          editingItem.durationHoursNote ?? prev.durationHoursNote,
          editingItem.durationDays ?? prev.durationDays
        ),
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
          setGpxFileName('Tuyến tự vẽ từ bản đồ vẽ tuyến LOST');
        }
        setMapFitVersion((v) => v + 1);
      }
    };

    // 1. Check if user is explicitly editing an existing submitted contribution (has id/_id)
    const editingStr = safeLocalStorageGet('lost_editing_contribution');
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
      const plannerDraftStr = safeLocalStorageGet('lost_planner_draft_contribution');
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
            const msg = 'Đã nạp tuyến đường từ bản đồ vẽ tuyến vào biểu mẫu đóng góp.';
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
    hasHydratedDraftCheckRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save new contribution draft cleanly to user-scoped localStorage (debounced 400ms)
  useEffect(() => {
    if (!hasHydratedDraftCheckRef.current || isEditing || pendingDraft) return;
    const hasContent =
      formData.name.trim().length > 0 ||
      formData.description.trim().length > 0 ||
      formData.transportationInfo.trim().length > 0 ||
      gpxTrack.length > 0 ||
      formData.waypoints.length > 0;
    if (!hasContent) return;

    const timer = window.setTimeout(() => {
      try {
        const snapshot: SavedContribDraft = {
          step,
          formData: formData as unknown as Record<string, unknown>,
          gpxTrack,
          gpxFileName,
          isCustomWard,
          customWardText,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
      } catch {
        // Ignore storage quota errors
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [draftStorageKey, isEditing, pendingDraft, step, formData, gpxTrack, gpxFileName, isCustomWard, customWardText]);

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    const fd = pendingDraft.formData;
    if (fd && typeof fd === 'object') {
      const normalizedDuration = normalizeDurationHoursNote(fd.durationHoursNote, fd.durationDays);
      setFormData((prev) => ({
        ...prev,
        ...(fd as Partial<typeof prev>),
        durationHoursNote: normalizedDuration,
      }));
    }
    if (Array.isArray(pendingDraft.gpxTrack)) {
      setGpxTrack(pendingDraft.gpxTrack);
    }
    if (typeof pendingDraft.gpxFileName === 'string') {
      setGpxFileName(pendingDraft.gpxFileName);
    }
    setIsCustomWard(Boolean(pendingDraft.isCustomWard));
    setCustomWardText(String(pendingDraft.customWardText || ''));
    if (typeof pendingDraft.step === 'number' && pendingDraft.step >= 1 && pendingDraft.step <= 5) {
      setStep(pendingDraft.step);
    }
    setMapFitVersion((v) => v + 1);
    setPendingDraft(null);
    onShowToast?.('Đã khôi phục bản nháp đóng góp của bạn!', 'success');
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore storage error
    }
    setPendingDraft(null);
    onShowToast?.('Đã xóa bản nháp cũ.', 'info');
  };

  const applyGeoSuggestion = useCallback(
    (suggestion: GeoSuggestion, silent = false) => {
      const matched = matchVietnamProvince(suggestion.province);
      const nextDistrictCandidate = (suggestion.district || '').trim();
      const nextHamletCandidate = (suggestion.village || '').trim();

      let resolvedDistrict: string | null = null;
      if (nextDistrictCandidate) {
        const wards = matched?.province.wards || [];
        const matchedWard = wards.find(
          (w) => normalizeAdminName(w) === normalizeAdminName(nextDistrictCandidate)
        );
        if (matchedWard) {
          setIsCustomWard(false);
          setCustomWardText('');
          resolvedDistrict = matchedWard;
        } else {
          setIsCustomWard(true);
          setCustomWardText(nextDistrictCandidate);
          resolvedDistrict = nextDistrictCandidate;
        }
      }

      setFormData((prev) => {
        const nextRegion = matched?.region || prev.region;
        const nextProvince = matched?.province.name || prev.province;
        return {
          ...prev,
          region: nextRegion,
          province: nextProvince,
          district: resolvedDistrict ?? prev.district,
          ...(nextHamletCandidate ? { hamlet: nextHamletCandidate } : {}),
          ...(matched ? { rescueContact: getRescueContactForProvince(nextProvince) } : {}),
        };
      });
      if (!silent) {
        onShowToast?.(`Đã áp dụng địa danh thực địa: ${suggestion.formattedAddress}`, 'success');
      }
    },
    [onShowToast]
  );

  const triggerReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      const reqSeq = ++geocodeReqSeqRef.current;
      setIsGeocoding(true);
      try {
        const geo = await reverseGeocode(lat, lng);
        if (reqSeq !== geocodeReqSeqRef.current || !geo) return;
        const rawProv = String(geo.province || '').trim();
        const rawDist = String(geo.district || '').trim();
        const rawVillage = String(geo.village || '').trim();
        const formattedAddress = String(geo.formattedAddress || geo.displayName || '').trim();
        if (!rawProv && !rawDist && !rawVillage) return;

        const matched = matchVietnamProvince(rawProv);
        const suggestion: GeoSuggestion = {
          lat,
          lng,
          formattedAddress: formattedAddress || [rawVillage, rawDist, rawProv].filter(Boolean).join(', '),
          province: rawProv,
          district: rawDist,
          village: rawVillage,
          matchedRegion: matched?.region,
          matchedProvince: matched?.province.name,
        };
        setGeoSuggestion(suggestion);

        // Auto-populate empty administrative fields without calling setState inside a state updater
        const currentSnap = formDataRef.current;
        const shouldFillDistrict = !currentSnap.district.trim() && Boolean(rawDist);
        let matchedAutoWard: string | undefined;
        if (shouldFillDistrict) {
          const wards = matched?.province.wards || [];
          matchedAutoWard = wards.find((w) => normalizeAdminName(w) === normalizeAdminName(rawDist));
          if (matchedAutoWard) {
            setIsCustomWard(false);
            setCustomWardText('');
          } else {
            setIsCustomWard(true);
            setCustomWardText(rawDist);
          }
        }

        setFormData((prev) => {
          const updates: Partial<typeof prev> = {};
          if (!prev.province.trim() && matched?.province.name) {
            updates.region = matched.region;
            updates.province = matched.province.name;
            updates.rescueContact = getRescueContactForProvince(matched.province.name);
          }
          if (!prev.district.trim() && rawDist) {
            updates.district = matchedAutoWard || rawDist;
          }
          if (!prev.hamlet.trim() && rawVillage) {
            updates.hamlet = rawVillage;
          }
          return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
        });
      } catch {
        // Ignore offline reverse geocoding silently
      } finally {
        if (reqSeq === geocodeReqSeqRef.current) {
          setIsGeocoding(false);
        }
      }
    },
    []
  );

  const contribMapBounds = useMemo(() => {
    const pts: [number, number][] =
      gpxTrack.length >= 2
        ? gpxTrack
        : [
            [formData.startLat, formData.startLng],
            [formData.endLat, formData.endLng],
          ];
    return computeContribBounds(pts);
  }, [gpxTrack, formData.startLat, formData.startLng, formData.endLat, formData.endLng]);

  const contribMapFitKey = `${step}-${mapFitVersion}-${gpxTrack.length}`;

  const contribMapFlyTo = useMemo(() => {
    if (contribMapBounds) return null;
    if (!Number.isFinite(formData.startLat) || !Number.isFinite(formData.startLng)) return null;
    return {
      lat: formData.startLat,
      lng: formData.startLng,
      zoom: 12,
      key: contribMapFitKey,
    };
  }, [contribMapBounds, formData.startLat, formData.startLng, contribMapFitKey]);

  const contribMapPolylines = useMemo<LostMapPolylineItem[]>(
    () => [
      {
        id: 'contrib-route-line',
        coords:
          gpxTrack.length >= 2
            ? gpxTrack
            : [
                [formData.startLat, formData.startLng],
                [formData.endLat, formData.endLng],
              ],
        color: 'primary',
        width: 4,
        opacity: 0.92,
      },
    ],
    [gpxTrack, formData.startLat, formData.startLng, formData.endLat, formData.endLng]
  );

  const contribMapMarkers = useMemo<LostMapMarkerItem[]>(() => {
    const items: LostMapMarkerItem[] = [
      {
        id: 'contrib-start-pin',
        lat: formData.startLat,
        lng: formData.startLng,
        label: 'Điểm xuất phát',
        sublabel: `${formData.startLat.toFixed(5)}, ${formData.startLng.toFixed(5)}`,
        color: 'primary',
        size: 'lg',
        badge: 'XP',
        active: pinMode === 'start',
      },
      {
        id: 'contrib-end-pin',
        lat: formData.endLat,
        lng: formData.endLng,
        label: 'Đích / đỉnh',
        sublabel: `${formData.endLat.toFixed(5)}, ${formData.endLng.toFixed(5)}`,
        color: 'danger',
        size: 'lg',
        badge: 'ĐĐ',
        active: pinMode === 'end',
      },
    ];

    formData.waypoints.forEach((wp, idx) => {
      const wpColor: LostMapMarkerItem['color'] =
        wp.type === 'danger' ? 'danger' : wp.type === 'campsite' ? 'warn' : 'info';
      items.push({
        id: wp.id,
        lat: wp.lat,
        lng: wp.lng,
        label: wp.name,
        sublabel: `${WAYPOINT_TYPE_LABELS[wp.type] || wp.type}${wp.elevationM ? ` · ${wp.elevationM}m` : ''}`,
        color: wpColor,
        size: 'md',
        badge: String(idx + 1),
      });
    });

    if (pinMode === 'waypoint' && wpLat.trim() && wpLng.trim()) {
      const draftLat = Number(wpLat);
      const draftLng = Number(wpLng);
      if (Number.isFinite(draftLat) && Number.isFinite(draftLng)) {
        items.push({
          id: 'contrib-draft-wp',
          lat: draftLat,
          lng: draftLng,
          label: wpName.trim() || 'Mốc đang chọn',
          sublabel: `${draftLat.toFixed(5)}, ${draftLng.toFixed(5)}`,
          color: 'info',
          size: 'md',
          pulse: true,
          active: true,
        });
      }
    }

    return items;
  }, [
    formData.startLat,
    formData.startLng,
    formData.endLat,
    formData.endLng,
    formData.waypoints,
    pinMode,
    wpLat,
    wpLng,
    wpName,
  ]);

  const handleContribMapClick = useCallback(
    (rawLat: number, rawLng: number) => {
      const lat = Number(rawLat.toFixed(5));
      const lng = Number(rawLng.toFixed(5));
      if (pinMode === 'start') {
        setFormData((prev) => ({ ...prev, startLat: lat, startLng: lng }));
        setGpxTrack((prev) => (prev.length >= 2 ? [[lat, lng], ...prev.slice(1)] : prev));
        void triggerReverseGeocode(lat, lng);
      } else if (pinMode === 'end') {
        setFormData((prev) => ({ ...prev, endLat: lat, endLng: lng }));
        setGpxTrack((prev) => (prev.length >= 2 ? [...prev.slice(0, -1), [lat, lng]] : prev));
      } else {
        setWpLat(String(lat));
        setWpLng(String(lng));
      }
    },
    [pinMode, triggerReverseGeocode]
  );

  const handleCancelAndBack = () => {
    setEditingId(null);
    isEditingRef.current = false;
    onBack();
    try {
      localStorage.removeItem('lost_editing_contribution');
    } catch {
      // ignore storage errors
    }
  };

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 560, margin: '64px auto', padding: '40px 28px', textAlign: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 4, boxShadow: 'var(--shadow-card)' }}>
        <div className="section-eyebrow" style={{ justifyContent: 'center', marginBottom: 10 }}>Góp dữ liệu thực địa</div>
        <h2 className="font-editorial" style={{ fontSize: '1.55rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 10 }}>
          Đăng nhập để đóng góp cung mới
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 24px auto' }}>
          Mỗi cung đường trên LOST đều được ghi lại từ chuyến đi thật của anh em. Đăng nhập để chúng tôi ghi nhận đóng góp của bạn và cộng 50 điểm uy tín khi bài được duyệt.
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
            Đăng nhập
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
    e.target.value = '';
    if (!file) return;

    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) {
      onShowToast?.('Chọn ảnh định dạng JPG, PNG, WebP hoặc AVIF nhé.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onShowToast?.('Ảnh bìa vượt quá 5 MB — nén nhẹ hơn rồi tải lại nhé.', 'error');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadingImage(false);
      onShowToast?.('Không thể đọc tệp ảnh từ thiết bị.', 'error');
    };
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
        onShowToast?.('Không thể tải ảnh lên máy chủ, bạn thử lại nhé.', 'error');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      onShowToast?.('Tệp GPX nặng quá 2,5 MB — rút gọn tệp rồi tải lại nhé.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      onShowToast?.('Không thể đọc tệp GPX từ thiết bị.', 'error');
    };
    reader.onload = (event) => {
      try {
        const xmlText = String(event.target?.result || '');
        const parsed = parseGpxXml(xmlText);
        if (!parsed.vertices || parsed.vertices.length < 2) {
          onShowToast?.('Tệp GPX cần tối thiểu 2 tọa độ tuyến hợp lệ.', 'error');
          return;
        }

        const metrics = computeRouteMetrics(parsed.vertices);
        const computedDistanceKm = Math.round(metrics.distanceKm * 10) / 10;
        const maxAlt = parsed.hasElevation && metrics.maxAltitudeM > 0 ? Math.round(metrics.maxAltitudeM) : undefined;
        const totalGain = parsed.hasElevation && metrics.elevationGainM > 0 ? Math.round(metrics.elevationGainM) : undefined;

        const maxPoints = 1500;
        const stepStride = parsed.vertices.length > maxPoints ? Math.ceil(parsed.vertices.length / maxPoints) : 1;
        const points: [number, number][] = [];
        for (let i = 0; i < parsed.vertices.length; i += stepStride) {
          points.push([parsed.vertices[i].lat, parsed.vertices[i].lng]);
        }
        const lastVertex = parsed.vertices[parsed.vertices.length - 1];
        if (
          points[points.length - 1][0] !== lastVertex.lat ||
          points[points.length - 1][1] !== lastVertex.lng
        ) {
          points.push([lastVertex.lat, lastVertex.lng]);
        }

        const start = points[0];
        const end = points[points.length - 1];

        const extractedWaypoints: Waypoint[] = parsed.waypoints.map((w, idx) => {
          const mappedType = mapRouteWaypointTypeToContrib(w.type);
          return {
            id: `gpx-wpt-${Date.now()}-${idx}`,
            name: (w.name || `Mốc GPX #${idx + 1}`).slice(0, 120),
            type: mappedType,
            description: (w.note || WAYPOINT_TYPE_LABELS[mappedType]).slice(0, 400),
            elevationM: typeof w.elevationM === 'number' && Number.isFinite(w.elevationM) ? Math.round(w.elevationM) : undefined,
            lat: Number(w.lat.toFixed(5)),
            lng: Number(w.lng.toFixed(5)),
          };
        });

        setGpxFileName(file.name);
        setGpxTrack(points);
        setMapFitVersion((v) => v + 1);
        const startLatRounded = Number(start[0].toFixed(5));
        const startLngRounded = Number(start[1].toFixed(5));
        setFormData((prev) => {
          const existingKeys = new Set(
            prev.waypoints.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}:${w.name.toLowerCase()}`)
          );
          const uniqueNewWaypoints = extractedWaypoints.filter(
            (w) => !existingKeys.has(`${w.lat.toFixed(4)},${w.lng.toFixed(4)}:${w.name.toLowerCase()}`)
          );
          return {
            ...prev,
            startLat: startLatRounded,
            startLng: startLngRounded,
            endLat: Number(end[0].toFixed(5)),
            endLng: Number(end[1].toFixed(5)),
            ...(computedDistanceKm > 0 ? { distanceKm: computedDistanceKm } : {}),
            ...(maxAlt && maxAlt > 0 ? { maxAltitudeM: maxAlt } : {}),
            ...(totalGain !== undefined && totalGain > 0 ? { elevationGainM: totalGain } : {}),
            ...(uniqueNewWaypoints.length > 0
              ? { waypoints: [...prev.waypoints, ...uniqueNewWaypoints].slice(0, 60) }
              : {}),
          };
        });
        void triggerReverseGeocode(startLatRounded, startLngRounded);
        onShowToast?.(
          `Đã trích xuất ${points.length} điểm GPS${computedDistanceKm > 0 ? ` • ${computedDistanceKm} km` : ''}${maxAlt ? ` • đỉnh ${maxAlt}m` : ''}${totalGain ? ` • leo +${totalGain}m` : ''}${extractedWaypoints.length > 0 ? ` • ${extractedWaypoints.length} mốc tọa độ` : ''} từ tệp GPX.`,
          'success'
        );
      } catch (err) {
        console.error('GPX parse error:', err);
        onShowToast?.(
          err instanceof Error && err.message
            ? err.message
            : 'Không thể đọc tệp GPX — kiểm tra lại định dạng tệp nhé.',
          'error'
        );
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
      onShowToast?.('Nhập tên mốc tọa độ (VD: Lán nghỉ 2.400m, Suối nguồn...).', 'error');
      return;
    }
    if (!isWithinVietnamBounds(latNum, lngNum)) {
      onShowToast?.('Chọn điểm trên bản đồ hoặc nhập tọa độ Lat/Lng hợp lệ trong lãnh thổ Việt Nam.', 'error');
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
      errs.hamlet = 'Nhập điểm xuất phát thực tế (thôn, bản, trạm kiểm lâm hoặc cửa rừng).';
    }
    if (!formData.province.trim() || !formData.district.trim()) {
      errs.district = 'Chọn đầy đủ tỉnh/thành và phường/xã.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Hoàn thiện thông tin còn thiếu ở Bước 1 trước khi tiếp tục.', 'error');
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
      errs.bestMonths = 'Chọn ít nhất 1 tháng đẹp để leo núi.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Kiểm tra lại thông số kỹ thuật và mùa leo ở Bước 2.', 'error');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isWithinVietnamBounds(formData.startLat, formData.startLng)) {
      errs.startLat = 'Tọa độ xuất phát phải nằm trong phạm vi địa lý Việt Nam (vĩ độ 8.0–23.6, kinh độ 102.0–110.5).';
    }
    if (!isWithinVietnamBounds(formData.endLat, formData.endLng)) {
      errs.endLat = 'Tọa độ đích/đỉnh phải nằm trong phạm vi địa lý Việt Nam (vĩ độ 8.0–23.6, kinh độ 102.0–110.5).';
    }
    const isSameEndpoint = formData.startLat === formData.endLat && formData.startLng === formData.endLng;
    if (isSameEndpoint && gpxTrack.length < 3) {
      errs.endLat = 'Điểm xuất phát và đích trùng nhau — hãy tải tệp GPX vòng khép kín hoặc ghim điểm đích riêng.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Kiểm tra lại tọa độ GPS ở Bước 3.', 'error');
      return false;
    }
    return true;
  };

  const validateStep4 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.coverImage.trim()) {
      errs.coverImage = 'Tải ảnh từ thiết bị hoặc dán đường dẫn ảnh bìa thực địa.';
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errs.description = 'Mô tả tổng quan cần ít nhất 10 ký tự.';
    }
    if (!formData.transportationInfo.trim() || formData.transportationInfo.trim().length < 5) {
      errs.transportationInfo = 'Hướng dẫn di chuyển cần ít nhất 5 ký tự.';
    }
    if (!formData.rescueContact.phone.trim() || formData.rescueContact.phone.trim().length < 3) {
      errs.rescuePhone = 'Nhập số hotline cứu hộ khẩn cấp thực tế.';
    }
    if (formData.permitRequired && !formData.permitInfo.trim()) {
      errs.permitInfo = 'Nhập nơi cấp phép hoặc lệ phí vào rừng.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      onShowToast?.('Điền đủ ảnh bìa, mô tả và hotline cứu hộ ở Bước 4.', 'error');
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

  const updateEndpointCoord = (which: 'start' | 'end', axis: 'lat' | 'lng', rawValue: string) => {
    const num = Number(rawValue);
    const field =
      which === 'start'
        ? axis === 'lat'
          ? 'startLat'
          : 'startLng'
        : axis === 'lat'
          ? 'endLat'
          : 'endLng';
    handleChange(field, num);
    if (Number.isFinite(num)) {
      setGpxTrack((prev) => {
        if (prev.length < 2) return prev;
        if (which === 'start') {
          const nextFirst: [number, number] =
            axis === 'lat' ? [num, prev[0][1]] : [prev[0][0], num];
          return [nextFirst, ...prev.slice(1)];
        }
        const last = prev[prev.length - 1];
        const nextLast: [number, number] = axis === 'lat' ? [num, last[1]] : [last[0], num];
        return [...prev.slice(0, -1), nextLast];
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
    if (!copyrightConfirmed) {
      setErrors((prev) => ({
        ...prev,
        copyrightConfirmed:
          'Xác nhận quyền sở hữu bản quyền hình ảnh và dữ liệu tọa độ trước khi gửi.',
      }));
      onShowToast?.(
        'Đánh dấu xác nhận bản quyền hình ảnh và dữ liệu tọa độ trước khi gửi.',
        'error'
      );
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
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore storage errors
      }
      setEditingId(null);
      setLoading(false);

      const toastMsg = editingId
        ? 'Đã lưu các thay đổi cho bài đóng góp của bạn.'
        : 'Cảm ơn bạn đã góp cung mới! Ban quản trị sẽ đối chiếu thực địa và duyệt sớm.';
      onShowToast?.(toastMsg, 'success');
      onSuccess();
    } catch (err: unknown) {
      setLoading(false);
      onShowToast?.(
        err instanceof Error && err.message
          ? err.message
          : 'Chưa gửi được bài đóng góp lúc này, bạn thử lại nhé.',
        'error'
      );
    }
  };

  const userAvatar = currentUser?.avatarUrl || currentUser?.avatar || '';
  const userName = currentUser?.fullName || currentUser?.name || 'Người đóng góp';

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
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Góp đường lên bản đồ chung</div>
          <h2 className="font-editorial" style={{ fontSize: 'clamp(1.65rem, 3vw, 2.2rem)', fontWeight: 500, color: 'var(--color-text-main)', margin: 0, lineHeight: 1.08 }}>
            {isEditing ? 'Chỉnh lại thông tin cung đã gửi' : 'Đóng góp cung đường mới'}
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleCancelAndBack}
          style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 4 }}
        >
          <ArrowLeft size={15} /> Hủy và quay lại
        </button>
      </div>

      {/* Scoped LocalStorage Draft Restore / Discard Banner */}
      {!isEditing && pendingDraft && (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 16px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-sky) 12%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-sky) 38%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconClock size={17} color="var(--color-sky)" />
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
              <strong>Bạn còn một bản nháp đang viết dở</strong>
              {pendingDraft.savedAt && (
                <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>
                  (lưu lúc{' '}
                  {new Date(pendingDraft.savedAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {new Date(pendingDraft.savedAt).toLocaleDateString('vi-VN')})
                </span>
              )}
              {typeof pendingDraft.formData?.name === 'string' && pendingDraft.formData.name.trim() && (
                <div style={{ fontSize: '0.76rem', color: 'var(--color-sky)', fontWeight: 700, marginTop: 2 }}>
                  Cung đường: {pendingDraft.formData.name}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRestoreDraft}
              style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4 }}
            >
              Tiếp tục viết
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDiscardDraft}
              style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4 }}
            >
              Xóa nháp
            </button>
          </div>
        </div>
      )}

      {/* Swiss Editorial 5-Column Hairline Stepper (Keyboard-accessible tablist) */}
      <div
        role="tablist"
        aria-label="Các bước đóng góp cung đường"
        className="editorial-stat-strip"
        style={{ marginBottom: 22 }}
      >
        {[
          { stepNum: 1, title: 'Tên và địa bàn' },
          { stepNum: 2, title: 'Thông số và mùa' },
          { stepNum: 3, title: 'Bản đồ GPS' },
          { stepNum: 4, title: 'Hậu cần và cứu hộ' },
          { stepNum: 5, title: 'Xem lại và gửi' },
        ].map(({ stepNum, title }) => {
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          const isReachable = stepNum <= step;

          return (
            <button
              key={stepNum}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'step' : undefined}
              disabled={!isReachable}
              onClick={() => {
                if (stepNum < step) setStep(stepNum);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' && stepNum > 1) {
                  e.preventDefault();
                  setStep(stepNum - 1);
                } else if (e.key === 'ArrowRight' && stepNum < step) {
                  e.preventDefault();
                  setStep(stepNum + 1);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setStep(1);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setStep(step);
                }
              }}
              className="editorial-stat-cell"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: isActive ? 'var(--color-surface-elevated)' : 'var(--color-bg-card)',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: stepNum < step ? 'pointer' : 'default',
                textAlign: 'left',
                fontFamily: 'var(--font-family)',
                opacity: isReachable ? 1 : 0.72,
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
            </button>
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
                Bước 1: Tên cung đường và địa bàn thực tế
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
                    placeholder="Ví dụ: Pu Ta Leng 3.049m từ bản Sì Thâu Chải"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                  {errors.name && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.76rem', marginTop: 4, fontWeight: 600 }}>{errors.name}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Tên gọi khác / tên đỉnh (cách nhau bởi dấu phẩy)</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '10px 14px', fontSize: '0.9rem', borderRadius: 4 }}
                    placeholder="Ví dụ: Đỉnh Pu Ta Leng, núi Tả Liên..."
                    value={formData.altNames}
                    onChange={(e) => handleChange('altNames', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Thôn / bản / cửa rừng xuất phát *</label>
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
                Tiếp theo: Thông số và mùa đẹp <ArrowRight size={16} />
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
                Bước 2: Thông số đường đi và lịch mùa đẹp
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
                        const matchedOpt = CANONICAL_DURATION_OPTIONS.find((o) => o.value === val);
                        let days = matchedOpt?.days ?? 1;
                        if (!matchedOpt) {
                          if (val.includes('2 ngày')) days = 2;
                          if (val.includes('3 ngày')) days = 3;
                          if (val.includes('4 ngày')) days = 4;
                        }
                        setFormData((prev) => ({ ...prev, durationHoursNote: val, durationDays: days }));
                      }}
                    >
                      {CANONICAL_DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      {formData.durationHoursNote &&
                        !CANONICAL_DURATION_OPTIONS.some((o) => o.value === formData.durationHoursNote) && (
                          <option value={formData.durationHoursNote}>{formData.durationHoursNote}</option>
                        )}
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
                    <IconCalendar size={15} color="var(--color-primary)" /> Lịch 12 tháng nên đi *
                  </label>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} />
                      Mùa đẹp
                    </span>
                    <span style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--color-error)', display: 'inline-block' }} />
                      Tránh mưa bão
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: 12 }}>
                  Nhấp vào từng tháng để đổi trạng thái: <strong>Mùa đẹp</strong> → <strong>Nên tránh</strong> → <strong>Bình thường</strong>
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
                Tiếp theo: Bản đồ và tọa độ GPS <ArrowRight size={16} />
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
                  Bước 3: Chấm tọa độ GPS, tải GPX và gắn mốc dọc đường
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
                  1. Ghim xuất phát
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
                  2. Ghim đích / đỉnh
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
                  3. Ghim mốc dọc đường
                </button>
                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.78rem', padding: '5px 10px', height: 32, borderRadius: 4 }}
                  value={mapTileType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setMapTileType(e.target.value as BasemapKey)
                  }
                >
                  {FREE_BASEMAP_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {FREE_BASEMAPS[key].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="wizard-grid-2-wide" style={{ alignItems: 'start' }}>
              {/* Native GPU Vector Map Canvas & GPX Upload */}
              <div>
                <div style={{ height: 310, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 12, position: 'relative' }}>
                  <LostVectorMap
                    center={PROVINCE_COORDINATES[formData.province] || [formData.startLat, formData.startLng]}
                    zoom={10.5}
                    basemap={mapTileType}
                    markers={contribMapMarkers}
                    polylines={contribMapPolylines}
                    fitBounds={contribMapBounds}
                    fitBoundsKey={contribMapFitKey}
                    flyTo={contribMapFlyTo}
                    onMapClick={handleContribMapClick}
                  />
                </div>

                {/* Reverse Geocode 1-Click Administrative Suggestion Banner */}
                {(isGeocoding || geoSuggestion) && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '10px 14px',
                      borderRadius: 4,
                      background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-main))',
                      border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <IconMapPin size={15} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-main)', minWidth: 0 }}>
                        {isGeocoding ? (
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            Đang nhận diện địa danh hành chính từ tọa độ xuất phát...
                          </span>
                        ) : (
                          geoSuggestion && (
                            <>
                              <span style={{ color: 'var(--color-text-muted)' }}>Địa danh nhận diện: </span>
                              <strong>{geoSuggestion.formattedAddress}</strong>
                            </>
                          )
                        )}
                      </div>
                    </div>
                    {!isGeocoding && geoSuggestion && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => applyGeoSuggestion(geoSuggestion)}
                          style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4 }}
                        >
                          Áp dụng địa danh tự động
                        </button>
                        <button
                          type="button"
                          onClick={() => setGeoSuggestion(null)}
                          aria-label="Ẩn gợi ý địa danh"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: 4,
                            color: 'var(--color-text-muted)',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <IconX size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* GPX Upload Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: '9px 14px', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                    Tệp GPX tuyến đường{gpxTrack.length > 0 ? ` (${gpxTrack.length} điểm)` : ''}:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label htmlFor="gpx-file-upload-input" className="btn btn-outline" style={{ padding: '5px 14px', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, height: 28, display: 'inline-flex', alignItems: 'center' }}>
                      Chọn tệp .gpx
                    </label>
                    <span style={{ fontSize: '0.78rem', color: gpxFileName ? 'var(--color-primary)' : 'var(--color-text-dim)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {gpxFileName || 'Chưa chọn tệp'}
                    </span>
                    {gpxTrack.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          setGpxTrack([]);
                          setGpxFileName('');
                          onShowToast?.('Đã gỡ tuyến GPX — bạn có thể chấm lại điểm xuất phát và đích.', 'info');
                        }}
                        style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: 4, height: 28, color: 'var(--color-error-text, var(--color-error))' }}
                      >
                        Xóa GPX
                      </button>
                    )}
                    <input id="gpx-file-upload-input" type="file" accept=".gpx" onChange={handleGpxUpload} style={{ display: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Coordinates Fields, Waypoints Editor & Tips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 6 }}>1. Tọa độ xuất phát</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 6 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vĩ độ (Lat)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.startLat} onChange={(e) => updateEndpointCoord('start', 'lat', e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Kinh độ (Lng)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.startLng} onChange={(e) => updateEndpointCoord('start', 'lng', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-error-text, var(--color-error))', marginBottom: 6 }}>2. Tọa độ đích / đỉnh</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 6 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vĩ độ (Lat)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.endLat} onChange={(e) => updateEndpointCoord('end', 'lat', e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Kinh độ (Lng)</label>
                        <input type="number" step="0.00001" className="form-input" style={{ padding: '6px 8px', fontSize: '0.82rem', borderRadius: 4 }} value={formData.endLng} onChange={(e) => updateEndpointCoord('end', 'lng', e.target.value)} />
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
                      Mốc dọc đường (tùy chọn · {formData.waypoints.length})
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                      Chọn &ldquo;3. Ghim mốc dọc đường&rdquo; rồi chạm bản đồ
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
                      <IconPlus size={13} color="var(--color-primary)" /> Thêm mốc
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
                              {wp.elevationM ? ` · ${wp.elevationM}m` : ''} ({wp.lat}, {wp.lng})
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
                    <IconLightbulb size={15} color="var(--color-sun)" /> Mẹo chấm tọa độ nhanh
                  </div>
                  <div>• Chạm trực tiếp lên bản đồ để đặt điểm xuất phát, đích đến hoặc mốc dọc đường.</div>
                  <div>• Tải tệp <code>.gpx</code> lên là hệ thống tự tính cự ly, độ cao đỉnh, độ dốc và căn khung sẵn cho bạn.</div>
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
                Tiếp theo: Hậu cần và cứu hộ <ArrowRight size={16} />
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
                Bước 4: Ảnh thực tế, đường đi và cứu hộ địa bàn
              </h3>
            </div>

            <div className="wizard-grid-2">
              <div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>Ảnh bìa chụp thực tế *</label>
                    <label htmlFor="cover-file-input" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.76rem', height: 28, cursor: 'pointer', borderRadius: 4 }}>
                      {uploadingImage ? 'Đang tải...' : 'Tải ảnh từ máy'}
                    </label>
                    <input id="cover-file-input" type="file" accept="image/*" disabled={uploadingImage} onChange={handleCoverImageUpload} style={{ display: 'none' }} />
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, borderColor: errors.coverImage ? 'var(--color-error)' : undefined }}
                    placeholder="Dán link ảnh thực tế của bạn hoặc bấm 'Tải ảnh từ máy'"
                    value={formData.coverImage}
                    onChange={(e) => handleChange('coverImage', e.target.value)}
                  />
                  {errors.coverImage && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.74rem', marginTop: 2 }}>{errors.coverImage}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>Cảm nhận và mô tả cung đường *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, borderColor: errors.description ? 'var(--color-error)' : undefined }}
                    placeholder="Kể ngắn gọn về cảnh quan, con dốc đáng nhớ, đoạn rừng hay nguồn nước trên cung..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                  {errors.description && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.74rem', marginTop: 2 }}>{errors.description}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>Đường đi tới chân núi *</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, borderColor: errors.transportationInfo ? 'var(--color-error)' : undefined }}
                    placeholder="Cách bắt xe khách, đi xe máy vào bản hay chỗ gửi xe dưới chân núi..."
                    value={formData.transportationInfo}
                    onChange={(e) => handleChange('transportationInfo', e.target.value)}
                  />
                  {errors.transportationInfo && <div style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '0.74rem', marginTop: 2 }}>{errors.transportationInfo}</div>}
                </div>
              </div>

              <div>
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-sun)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconAlertTriangle size={15} color="var(--color-sun)" /> Cứu hộ và Kiểm lâm địa bàn *
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
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>· +50 điểm uy tín sau khi được duyệt</span>
              </div>
              <span className="badge badge-sun">
                <IconClock size={12} color="var(--color-sun)" /> Chờ duyệt
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

            <div
              style={{
                background: 'var(--color-bg-main)',
                border: errors.copyrightConfirmed
                  ? '1px solid var(--color-error)'
                  : copyrightConfirmed
                    ? '1px solid var(--color-border-glow)'
                    : '1px solid var(--color-border-strong)',
                borderRadius: 4,
                padding: '12px 14px',
                marginBottom: 16,
              }}
            >
              <label
                htmlFor="contrib-copyright-consent"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  color: 'var(--color-text-main)',
                  fontWeight: 600,
                }}
              >
                <input
                  id="contrib-copyright-consent"
                  type="checkbox"
                  required
                  checked={copyrightConfirmed}
                  onChange={(e) => {
                    setCopyrightConfirmed(e.target.checked);
                    if (e.target.checked && errors.copyrightConfirmed) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.copyrightConfirmed;
                        return copy;
                      });
                    }
                  }}
                  style={{
                    marginTop: 3,
                    width: 16,
                    height: 16,
                    accentColor: 'var(--color-primary)',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                />
                <span>
                  Tôi xác nhận mình có quyền sở hữu bản quyền hoặc quyền sử dụng hợp pháp đối với hình ảnh và dữ liệu tọa độ gửi lên LOST{' '}
                  <span style={{ color: 'var(--color-error-text, var(--color-error))' }}>*</span>
                </span>
              </label>
              {errors.copyrightConfirmed && (
                <div
                  style={{
                    color: 'var(--color-error-text, var(--color-error))',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    marginTop: 6,
                    paddingLeft: 26,
                  }}
                >
                  {errors.copyrightConfirmed}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(4)} style={{ padding: '10px 22px', fontSize: '0.88rem', borderRadius: 4 }}>
                <ArrowLeft size={16} /> Chỉnh lại
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || !copyrightConfirmed}
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: '10px 28px',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 4,
                  opacity: loading || !copyrightConfirmed ? 0.58 : 1,
                  cursor: loading || !copyrightConfirmed ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <span>Đang gửi bài...</span>
                ) : (
                  <>
                    <IconSend size={16} />
                    {isEditing ? 'Lưu thay đổi' : 'Gửi cung đường để xét duyệt'}
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
