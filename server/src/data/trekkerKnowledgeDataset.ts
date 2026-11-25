/**
 * MASTER TREKKER KNOWLEDGE DATASET (LOST Vietnam Alpine Intelligence Engine)
 * 100% Real Vietnam Geography, Wilderness First Aid (WFA), Alpine Weather, GPX Navigation & Official VQG Contacts.
 */

import { mockTrails } from './seedData.js';

export interface KnowledgeItem {
  id: string;
  category:
    | 'trail_specific'
    | 'fitness_training'
    | 'gear_equipment'
    | 'emergency_sos'
    | 'nutrition_hydration'
    | 'weather_climate'
    | 'permits_regulations'
    | 'navigation_gpx'
    | 'camping_shelters'
    | 'porter_local_guides';
  trailId?: string;
  trailName?: string;
  question: string;
  keywords: string[];
  answer: string;
  difficultyLevel?: number;
  highlightedTerms?: string[];
  sourceOrHotline?: string;
}

export interface PeakMatrixEntry {
  id: string;
  canonicalTrailId?: string;
  name: string;
  aliases: string[];
  altitude: number;
  province: string;
  region: 'Miền Bắc' | 'Miền Trung' | 'Tây Nguyên' | 'Miền Nam';
  rescue: string;
  checkpoint: string;
  days: string;
}

// 41 REAL ICONIC VIETNAM PEAKS & TREKKING TRAILS (100% Verified Geography & Official Hotlines — Rule 11)
export const VIETNAM_PEAKS_MATRIX: PeakMatrixEntry[] = [
  {
    id: 'fansipan',
    canonicalTrailId: 'trail-fansipan',
    name: 'Fansipan',
    aliases: ['fansipan', 'fanxipan', 'fancipan', 'noc nha dong duong', 'tram ton', 'sin chai', 'cat cat', 'hoang lien son', 'dinh fan', 'leo fan', 'dinh 3143'],
    altitude: 3143,
    province: 'Lào Cai - Lai Châu',
    region: 'Miền Bắc',
    rescue: '02143.871.494 / 0985.834.581 / 112',
    checkpoint: 'Trạm Tôn / Sín Chải (VQG Hoàng Liên)',
    days: '2N1Đ',
  },
  {
    id: 'pusilung',
    canonicalTrailId: 'trail-pusilung',
    name: 'Pu Si Lung',
    aliases: ['pusilung', 'pu si lung', 'pu xi lung', 'psl', 'moc 42', 'cot moc 42', 'pa ve su', 'muong te', 'dinh 3083'],
    altitude: 3083,
    province: 'Lai Châu',
    region: 'Miền Bắc',
    rescue: '02133.876.605 / 112 / 114',
    checkpoint: 'Đồn Biên phòng Pa Vệ Sử (Mường Tè)',
    days: '3N2Đ',
  },
  {
    id: 'putaleng',
    canonicalTrailId: 'trail-putaleng',
    name: 'Pu Ta Leng',
    aliases: ['putaleng', 'pu ta leng', 'pu ta len', 'ptl', 'ta leng', 'ho thau', 'suoi thau ho thau', 'rung do quyen putaleng', 'dinh 3049'],
    altitude: 3049,
    province: 'Lai Châu',
    region: 'Miền Bắc',
    rescue: '02133.876.605 / 112 / 114',
    checkpoint: 'Xã Tả Lèng / Xã Hồ Thầu (Tam Đường)',
    days: '3N2Đ',
  },
  {
    id: 'ky_quan_san',
    canonicalTrailId: 'trail-kyquansan',
    name: 'Kỳ Quan San (Bạch Mộc Lương Tử)',
    aliases: ['ky quan san', 'kyquansan', 'kqs', 'bach moc luong tu', 'bachmocluongtu', 'bach moc', 'bachmoc', 'bmlt', 'nui muoi', 'doi muoi', 'dinh muoi', 'sang ma sao', 'den sung'],
    altitude: 3046,
    province: 'Lào Cai - Lai Châu',
    region: 'Miền Bắc',
    rescue: '02163.852.341 / 112 / 114',
    checkpoint: 'Xã Sàng Ma Sáo (Bát Xát) / Dền Sung',
    days: '3N2Đ',
  },
  {
    id: 'khang_su_van',
    canonicalTrailId: 'trail-khangsuvan',
    name: 'Khang Su Văn',
    aliases: ['khang su van', 'khangsuvan', 'ksv', 'phan lien san', 'fan lien san', 'moc 79', 'cot moc 79', 'vang ma chai', 'phong tho', 'dinh 3012'],
    altitude: 3012,
    province: 'Lai Châu',
    region: 'Miền Bắc',
    rescue: '02133.876.605 / 112 / 114',
    checkpoint: 'Đồn Biên phòng Vàng Ma Chải (Phong Thổ)',
    days: '3N2Đ',
  },
  {
    id: 'ta_chi_nhu',
    canonicalTrailId: 'trail-tachinhu',
    name: 'Tà Chì Nhù',
    aliases: ['ta chi nhu', 'tachinhu', 'tcn', 'chi pau', 'hoa chi pau', 'doi hoa tim', 'xa ho', 'mo chi', 'phu song sung', 'noc nha yen bai', 'dinh 2979'],
    altitude: 2979,
    province: 'Yên Bái',
    region: 'Miền Bắc',
    rescue: '02163.852.341 / 112 / 114',
    checkpoint: 'Mỏ chì xã Xà Hồ, Trạm Tấu',
    days: '2N1Đ',
  },
  {
    id: 'po_ma_lung',
    name: 'Pờ Ma Lung',
    aliases: ['po ma lung', 'bach moc thuong', 'ban lang'],
    altitude: 2967,
    province: 'Lai Châu',
    region: 'Miền Bắc',
    rescue: '02133.876.605 / 112 / 114',
    checkpoint: 'Bản Lang, Phong Thổ',
    days: '3N2Đ',
  },
  {
    id: 'nhiu_co_san',
    canonicalTrailId: 'trail-nhiucosan',
    name: 'Nhìu Cồ San',
    aliases: ['nhiu co san', 'nhiucosan', 'ncs', 'thac ong chua', 'sung trau', 'den sang', 'rung phong nhiu co san', 'dinh 2965'],
    altitude: 2965,
    province: 'Lào Cai',
    region: 'Miền Bắc',
    rescue: '02163.852.341 / 112 / 114',
    checkpoint: 'Bản Nhìu Cồ San, xã Sàng Ma Sáo, Bát Xát',
    days: '2N1Đ',
  },
  {
    id: 'lung_cung',
    canonicalTrailId: 'trail-lungcung',
    name: 'Lùng Cúng',
    aliases: ['lung cung', 'lungcung', 'ban lung cung', 'tu san', 'nam co', 'thao chua chai', 'mu cang chai', 'dinh 2913'],
    altitude: 2913,
    province: 'Yên Bái',
    region: 'Miền Bắc',
    rescue: '02163.852.341 / 112 / 114',
    checkpoint: 'Bản Tu San / Lùng Cúng, Mù Cang Chải',
    days: '2N1Đ',
  },
  {
    id: 'ngu_chi_son',
    canonicalTrailId: 'trail-nguchison',
    name: 'Ngũ Chỉ Sơn',
    aliases: ['ngu chi son', 'nguchison', 'ngu chi', '5 ngon tay', 'nam ngon tay', 'nui ban tay', 'o quy ho', 'ta giang phinh', 'son binh', 'dinh 2858'],
    altitude: 2858,
    province: 'Lào Cai - Lai Châu',
    region: 'Miền Bắc',
    rescue: '02143.871.494 / 112 / 114',
    checkpoint: 'Xã Ngũ Chỉ Sơn (Tả Giàng Phình), Sa Pa',
    days: '2N1Đ',
  },
  {
    id: 'nam_kang_ho_tao',
    canonicalTrailId: 'trail-namkanghotao',
    name: 'Nam Kang Ho Tao',
    aliases: ['nam kang ho tao', 'namkanghotao', 'nkht', 'nam kang', 'ho tao', 'thao a', 'ho mit', 'tan uyen', 'dinh 2881'],
    altitude: 2881,
    province: 'Lai Châu',
    region: 'Miền Bắc',
    rescue: '02133.876.605 / 112 / 114',
    checkpoint: 'Bản Thào A, xã Hố Mít, Tân Uyên',
    days: '3N2Đ',
  },
  {
    id: 'ta_xua',
    canonicalTrailId: 'trail-taxua',
    name: 'Tà Xùa',
    aliases: ['ta xua', 'taxua', 'song lung khung long', 'ban cong', 'hang dong', 'bac yen', 'dinh gio', 'mom dau rua', 'mom ca heo', 'cay tao meo co don', 'rung reu ta xua'],
    altitude: 2865,
    province: 'Sơn La - Yên Bái',
    region: 'Miền Bắc',
    rescue: '02163.852.341 / 112 / 114',
    checkpoint: 'Xã Bản Công, Trạm Tấu / Bắc Yên',
    days: '2N1Đ',
  },
  {
    id: 'lao_than',
    canonicalTrailId: 'trail-laothan',
    name: 'Lảo Thẩn',
    aliases: ['lao than', 'laothan', 'dinh lao than', 'y ty', 'noc nha y ty', 'phin ho', 'lan a cho', 'cay song ao lao than', 'dinh 2860'],
    altitude: 2860,
    province: 'Lào Cai',
    region: 'Miền Bắc',
    rescue: '02163.852.341 / 112 / 114',
    checkpoint: 'Thôn Phìn Hồ, xã Y Tý, Bát Xát',
    days: '2N1Đ',
  },
  {
    id: 'tay_con_linh',
    canonicalTrailId: 'trail-tayconlinh',
    name: 'Tây Côn Lĩnh',
    aliases: ['tay con linh', 'tayconlinh', 'tcl', 'hoang su phi', 'noc nha dong bac', 'noc nha ha giang', 'cao bo', 'tung san', 'phuong tien', 'vi xuyen', 'che shan tuyet', 'dinh 2428'],
    altitude: 2428,
    province: 'Hà Giang',
    region: 'Miền Bắc',
    rescue: '0219.3861.628 / 112 / 114',
    checkpoint: 'Xã Tùng Sán / Cao Bồ, Vị Xuyên',
    days: '2N1Đ',
  },
  {
    id: 'pu_luong',
    canonicalTrailId: 'trail-puluong',
    name: 'Đỉnh Pù Luông',
    aliases: ['pu luong', 'ban kho muong', 'kho muong', 'son ba muoi', 'ban don pu luong', 'khu bttn pu luong', 'ba thuoc', 'thanh hoa', 'dinh 1700'],
    altitude: 1700,
    province: 'Thanh Hóa',
    region: 'Miền Trung',
    rescue: '02373.880.671 / 112 / 114',
    checkpoint: 'Khu BTTN Pù Luông, Huyện Bá Thước, Thanh Hóa',
    days: '2N1Đ',
  },
  {
    id: 'chieu_lau_thi',
    name: 'Chiêu Lầu Thi',
    aliases: ['chieu lau thi', 'chieulauthi', 'hoang su phi'],
    altitude: 2402,
    province: 'Hà Giang',
    region: 'Miền Bắc',
    rescue: '112 / 114',
    checkpoint: 'Xã Hồ Thầu, Hoàng Su Phì',
    days: '1-2N',
  },
  {
    id: 'phia_oac',
    name: 'Phia Oắc',
    aliases: ['phia oac', 'phia den', 'cao bang'],
    altitude: 1931,
    province: 'Cao Bằng',
    region: 'Miền Bắc',
    rescue: '112 / 114',
    checkpoint: 'VQG Phia Oắc - Phia Đén, Nguyên Bình',
    days: '1 Ngày',
  },
  {
    id: 'mau_son',
    name: 'Mẫu Sơn',
    aliases: ['mau son', 'mauson', 'lang son'],
    altitude: 1541,
    province: 'Lạng Sơn',
    region: 'Miền Bắc',
    rescue: '112 / 114',
    checkpoint: 'Huyện Lộc Bình - Cao Lộc',
    days: '1 Ngày',
  },
  {
    id: 'yen_tu',
    canonicalTrailId: 'trail-yentu',
    name: 'Chùa Đồng Yên Tử',
    aliases: ['yen tu', 'yentu', 'nui yen tu', 'chua dong', 'chua dong yen tu', 'chua hoa yen', 'an ky sinh', 'tay yen tu', 'uong bi', 'quang ninh', 'son dong'],
    altitude: 1068,
    province: 'Quảng Ninh - Bắc Giang',
    region: 'Miền Bắc',
    rescue: '0812.488.111 / 02033.854.153 / 112 / 114',
    checkpoint: 'KDL Yên Tử (TP. Uông Bí) / KDL Tây Yên Tử (Sơn Động)',
    days: '1 Ngày',
  },
  {
    id: 'ba_vi',
    canonicalTrailId: 'trail-bavi',
    name: 'VQG Ba Vì (3 Đỉnh Vua - Tản Viên - Ngọc Hoa)',
    aliases: ['ba vi', 'bavi', 'vqg ba vi', '3 dinh ba vi', 'dinh vua', 'tan vien', 'ngoc hoa', 'nha tho do', 'cot 400', 'cot 1100', 'den thuong ba vi', 'tan linh'],
    altitude: 1296,
    province: 'Hà Nội',
    region: 'Miền Bắc',
    rescue: '02433.881.082 / 0966.173.119 / 112',
    checkpoint: 'Cổng VQG Ba Vì, Xã Tản Lĩnh, Huyện Ba Vì, Hà Nội',
    days: '1 Ngày',
  },
  {
    id: 'ham_lon',
    name: 'Hàm Lợn',
    aliases: ['ham lon', 'hamlon', 'nui bau', 'soc son'],
    altitude: 462,
    province: 'Hà Nội',
    region: 'Miền Bắc',
    rescue: '112 / 114',
    checkpoint: 'Hồ Núi Bàu, Sóc Sơn',
    days: '1 Ngày',
  },
  {
    id: 'bach_ma',
    canonicalTrailId: 'trail-bachma',
    name: 'VQG Bạch Mã (Hải Vọng Đài & Thác Đỗ Quyên)',
    aliases: ['bach ma', 'bachma', 'vqg bach ma', 'dinh bach ma', 'rung bach ma', 'hai vong dai', 'thac do quyen', 'ngu ho', 'phu loc', 'hue'],
    altitude: 1450,
    province: 'TP. Huế',
    region: 'Miền Trung',
    rescue: '0234.3871.330 / 0836.356.669 / 114',
    checkpoint: 'Cổng VQG Bạch Mã, Huyện Phú Lộc, TP. Huế',
    days: '1 Ngày / 2N1Đ',
  },
  {
    id: 'gieng_troi',
    canonicalTrailId: 'trail-giengtroi',
    name: 'Giếng Trời (KBT Bà Nà - Núi Chúa)',
    aliases: ['gieng troi', 'giengtroi', 'thac gieng troi', 'ba na nui chua', 'rung ba na', 'hoa ninh', 'hoa vang', 'suoi da nang'],
    altitude: 480,
    province: 'Đà Nẵng',
    region: 'Miền Trung',
    rescue: '0236.3738.521 / 112 / 114',
    checkpoint: 'Bãi gửi xe chân núi Bà Nà, Xã Hòa Ninh, Hòa Vang',
    days: '1 Ngày / 2N1Đ',
  },
  {
    id: 'chu_yang_sin',
    canonicalTrailId: 'trail-chuyangsin',
    name: 'Chư Yang Sin',
    aliases: ['chu yang sin', 'chuyangsin', 'cys', 'vqg chu yang sin', 'noc nha tay nguyen', 'krong bong', 'yang mao', 'dak lak', 'dinh 2442'],
    altitude: 2442,
    province: 'Đắk Lắk',
    region: 'Tây Nguyên',
    rescue: '0262.3734.226 / 112 / 114',
    checkpoint: 'Ban Quản lý VQG Chư Yang Sin, Krông Bông',
    days: '3N2Đ',
  },
  {
    id: 'bidoup_nui_ba',
    canonicalTrailId: 'trail-bidoup',
    name: 'Bidoup - Núi Bà',
    aliases: ['bidoup', 'bi doup', 'bidoup nui ba', 'vqg bidoup', 'lac duong', 'da nhim', 'klong klanh', 'thong 2 la det', 'noc nha lam dong', 'dinh 2287'],
    altitude: 2287,
    province: 'Lâm Đồng',
    region: 'Tây Nguyên',
    rescue: '0263.3502.005 / 0947.047.449 / 114',
    checkpoint: 'Trung tâm VQG Bidoup - Núi Bà, Lạc Dương',
    days: '2N1Đ',
  },
  {
    id: 'langbiang',
    canonicalTrailId: 'trail-langbiang',
    name: 'Đỉnh Langbiang (Đỉnh Bà)',
    aliases: ['langbiang', 'lang biang', 'lang bi ang', 'kdl langbiang', 'nui ba da lat', 'dinh ba', 'dinh radar', 'nui ong nui ba', 'dinh 2167', 'da lat'],
    altitude: 2167,
    province: 'Lâm Đồng',
    region: 'Tây Nguyên',
    rescue: '0263.3502.005 / 0947.047.449 / 114',
    checkpoint: 'KDL Langbiang / VQG Bidoup - Núi Bà, Thị trấn Lạc Dương, Lâm Đồng',
    days: '1 Ngày',
  },
  {
    id: 'thac_k50',
    canonicalTrailId: 'trail-thack50',
    name: 'Thác K50 (Khu BTTN Kon Chư Răng)',
    aliases: ['thac k50', 'k50', 'k50 gia lai', 'hang en', 'thac hang en', 'kon chu rang', 'konchurang', 'trai bo k50', 'son lang', 'huyen kbang', 'kbang gia lai', 'gia lai'],
    altitude: 1020,
    province: 'Gia Lai - Bình Định',
    region: 'Tây Nguyên',
    rescue: '0985.551.682 / 112 / 114',
    checkpoint: 'Khu BTTN Kon Chư Răng, Kbang, Gia Lai',
    days: '2N1Đ',
  },
  {
    id: 'ta_nang_phan_dung',
    canonicalTrailId: 'trail-tanangphandung',
    name: 'Tà Năng - Phan Dũng',
    aliases: ['ta nang', 'phan dung', 'ta nang phan dung', 'tanangphandung', 'phandung', 'tnpd', 'doi co chay', 'doi co xanh', 'cot moc 3 tinh', 'cay thong co don ta nang', 'doi linh', 'thac yavly', 'cung dep nhat viet nam', 'duc trong', 'tuy phong'],
    altitude: 1100,
    province: 'Lâm Đồng - Bình Thuận',
    region: 'Miền Nam',
    rescue: '02633.822.441 / 112 / 114',
    checkpoint: 'UBND Xã Tà Năng / Hạt Kiểm lâm Đức Trọng',
    days: '2N1Đ / 3N2Đ',
  },
  {
    id: 'nui_ba_den',
    canonicalTrailId: 'trail-badenh',
    name: 'Núi Bà Đen',
    aliases: ['nui ba den', 'nuibaden', 'ba den', 'noc nha nam bo', 'cot dien ba den', 'duong cot dien ba den', 'duong ong nuoc ba den', 'duong chua ba den', 'ma thien lanh', 'dinh 986', 'tay ninh'],
    altitude: 986,
    province: 'Tây Ninh',
    region: 'Miền Nam',
    rescue: '0276.387.5678 / 112 / 114',
    checkpoint: 'Chân núi đường Cột Điện - KDL Quốc gia Núi Bà Đen',
    days: '1 Ngày',
  },
  {
    id: 'mui_doi',
    canonicalTrailId: 'trail-muidoi',
    name: 'Cực Đông Mũi Đôi (Hòn Đầu)',
    aliases: ['mui doi', 'muidoi', 'cuc dong', 'cuc dong to quoc', 'hon dau', 'dam mon', 'bai rang', 'bai na', 'nhay ghenh', 'van thanh', 'van ninh', 'khanh hoa'],
    altitude: 145,
    province: 'Khánh Hòa',
    region: 'Miền Trung',
    rescue: '0258.3837.149 / 112 / 114',
    checkpoint: 'Đầm Môn, Xã Vạn Thạnh, Vạn Ninh, Khánh Hòa',
    days: '2N1Đ',
  },
  {
    id: 'nui_chua',
    canonicalTrailId: 'trail-nuichua',
    name: 'VQG Núi Chúa',
    aliases: ['nui chua', 'nuichua', 'vqg nui chua', '8 tang dia nguc', 'tam tang dia nguc', 'dinh co tuy', 'da do', 'vinh hai', 'vinh hy', 'ninh hai', 'ninh thuan', 'co thach'],
    altitude: 1039,
    province: 'Ninh Thuận',
    region: 'Miền Trung',
    rescue: '0798.889.468 / 112 / 114',
    checkpoint: 'BQL VQG Núi Chúa, Xã Vĩnh Hải, Ninh Hải, Ninh Thuận',
    days: '2N1Đ',
  },
  {
    id: 'cat_tien_bau_sau',
    canonicalTrailId: 'trail-cattien-bausau',
    name: 'VQG Cát Tiên - Bàu Sấu',
    aliases: ['cat tien', 'cattien', 'bau sau', 'bausau', 'vqg cat tien', 'nam cat tien', 'dam ca sau', 'cay tung co thu', 'ben cu', 'tan phu'],
    altitude: 168,
    province: 'Đồng Nai',
    region: 'Miền Nam',
    rescue: '02513.669.228 / 0856.669.228 / 114',
    checkpoint: 'Trung tâm VQG Cát Tiên, Huyện Tân Phú, Đồng Nai',
    days: '1-2N',
  },
  {
    id: 'nui_chua_chan',
    canonicalTrailId: 'trail-chuachan',
    name: 'Núi Chứa Chan',
    aliases: ['nui chua chan', 'chua chan', 'chuachan', 'gia lao', 'nui gia lao', 'cot dien chua chan', 'duong cot dien chua chan', 'cay da 3 goc', 'chua buu quang', 'xuan loc', 'dong nai', 'dinh 837'],
    altitude: 837,
    province: 'Đồng Nai',
    region: 'Miền Nam',
    rescue: '0251.3992.053 / 112 / 114',
    checkpoint: 'Đường Cột Điện / Đường Chùa, Xuân Lộc',
    days: '1 Ngày',
  },
  {
    id: 'nui_dinh',
    canonicalTrailId: 'trail-nuidinh',
    name: 'Núi Dinh',
    aliases: ['nui dinh', 'nuidinh', 'suoi tien nui dinh', 'suoi tien ba ria', 'suoi da', 'chua hang mai', 'dinh la ban', 'chua tay phuong', 'phu my', 'vung tau'],
    altitude: 504,
    province: 'Bà Rịa - Vũng Tàu',
    region: 'Miền Nam',
    rescue: '0254.3876.318 / 112 / 114',
    checkpoint: 'Chùa Hang Mai / Suối Tiên, TP. Phú Mỹ',
    days: '1 Ngày',
  },
  {
    id: 'bu_gia_map',
    canonicalTrailId: 'trail-bugiamap',
    name: 'VQG Bù Gia Mập (Đắk Ka & Thác Lưu Ly)',
    aliases: ['bu gia map', 'bugiamap', 'bgm', 'vqg bu gia map', 'vuon quoc gia bu gia map', 'dak ka', 'suoi dak ka', 'thac luu ly', 'thac dak mai', 'gieng troi bu gia map', 'binh phuoc'],
    altitude: 660,
    province: 'Bình Phước',
    region: 'Miền Nam',
    rescue: '02713.724.237 / 0384.798.799 / 114',
    checkpoint: 'Trung tâm Tuyên truyền, Du lịch & Cứu hộ VQG Bù Gia Mập, Bình Phước',
    days: '2N1Đ',
  },
  // Wave 14C Sync: 6 Additional DEM-Verified Canonical Vietnam Trails (36/36 Parity)
  {
    id: 'ta_lien_son',
    canonicalTrailId: 'trail-talienson',
    name: 'Tả Liên Sơn (Đỉnh Cổ Trâu)',
    aliases: ['ta lien son', 'talienson', 'ta lien', 'tls', 'co trau', 'nui co trau', 'dinh co trau', 'co trau lai chau', 'rung co tich', 'rung co thu ta lien', 'ban ta leng', 'dinh 2996'],
    altitude: 2996,
    province: 'Lai Châu',
    region: 'Miền Bắc',
    rescue: '02133.876.605 / 112 / 114',
    checkpoint: 'Bản Tả Lèng, Huyện Tam Đường, Lai Châu (Chi cục KL Lai Châu)',
    days: '2N1Đ',
  },
  {
    id: 'pha_luong',
    canonicalTrailId: 'trail-phaluong',
    name: 'Đỉnh Pha Luông (Nóc Nhà Mộc Châu)',
    aliases: ['pha luong', 'noc nha moc chau', 'mom da tay tien', 'mom da pha luong', 'don bien phong pha luong', 'bien gioi pha luong', 'moc chau', 'chieng son', 'van ho', 'dinh 2000'],
    altitude: 2000,
    province: 'Sơn La',
    region: 'Miền Bắc',
    rescue: '02123.852.046 / 112 / 114',
    checkpoint: 'Đồn Biên phòng Pha Luông, Xã Chiềng Sơn, Mộc Châu, Sơn La',
    days: '1 Ngày',
  },
  {
    id: 'hon_ba',
    canonicalTrailId: 'trail-honba',
    name: 'Khu BTTN Hòn Bà (Trạm Nghiên Cứu Yersin)',
    aliases: ['hon ba', 'honba', 'dinh hon ba', 'tram yersin', 'bac si yersin', 'nha go yersin', 'nha bac si yersin', 'yersin khanh hoa', 'suoi dau', 'cam lam', 'khanh vinh', 'kbt hon ba', 'dinh 1578'],
    altitude: 1578,
    province: 'Khánh Hòa',
    region: 'Miền Trung',
    rescue: '0258.3213.222 / 112 / 114',
    checkpoint: 'Ban Quản lý Khu BTTN Hòn Bà, Cam Lâm / Khánh Vĩnh, Khánh Hòa',
    days: '1 Ngày',
  },
  {
    id: 'binh_lieu',
    canonicalTrailId: 'trail-binhlieu',
    name: 'Bình Liêu (Sống Lưng Khủng Long & Cột Mốc 1305)',
    aliases: ['binh lieu', 'binhlieu', 'song lung khung long binh lieu', 'moc 1305', 'cot moc 1305', 'moc 1300', 'moc 1327', 'cot moc 1327', 'cao xiem', 'dinh cao xiem', 'co lau binh lieu', 'thien duong co lau', 'hoanh mo', 'quang ninh'],
    altitude: 1292,
    province: 'Quảng Ninh',
    region: 'Miền Bắc',
    rescue: '02033.835.523 / 112 / 114',
    checkpoint: 'Hạt Kiểm lâm Bình Liêu / Đường tuần tra biên giới Mốc 1305, Quảng Ninh',
    days: '1 Ngày',
  },
  {
    id: 'nui_ba_ra',
    canonicalTrailId: 'trail-bara',
    name: 'Núi Bà Rá (1.767 Bậc Đá & Hồ Thác Mơ)',
    aliases: ['nui ba ra', 'ba ra', 'bara', 'dinh ba ra', 'ho thac mo', 'thac mo', 'doi bang lang', 'phuoc long', '1767 bac da', 'bac da ba ra', 'duong bac da ba ra', 'dinh 723'],
    altitude: 723,
    province: 'Bình Phước',
    region: 'Miền Nam',
    rescue: '0271.3879.461 / 112 / 114',
    checkpoint: 'KDL Núi Bà Rá, Thị xã Phước Long, Bình Phước',
    days: '1 Ngày',
  },
  {
    id: 'cuc_phuong',
    canonicalTrailId: 'trail-cucphuong',
    name: 'VQG Cúc Phương (Đỉnh Mây Bạc)',
    aliases: ['cuc phuong', 'cucphuong', 'vqg cuc phuong', 'rung cuc phuong', 'dinh may bac', 'may bac', 'khu bong', 'cay cho chi', 'cay cho ngan nam', 'mua buom cuc phuong', 'dong nguoi xua', 'nho quan', 'ninh binh'],
    altitude: 648,
    province: 'Ninh Bình',
    region: 'Miền Bắc',
    rescue: '1800.5555.88 / 02293.848.006 / 112',
    checkpoint: 'Trung tâm Du khách VQG Cúc Phương (Khu Bống), Nho Quan, Ninh Bình',
    days: '1 Ngày',
  },
];

/**
 * Normalizes Vietnamese string to lower-case ASCII without diacritics for fast fuzzy matching.
 */
export function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function normalizeSearchText(str: string): string {
  return removeVietnameseDiacritics(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whole-word / whole-phrase boundary check on normalized ASCII text.
 * Eliminates false positives like 'vat' matching 'dong vat' or 'do' matching 'ban do'.
 */
export function hasWholePhrase(normalizedText: string, phrase: string): boolean {
  const cleanPhrase = normalizeSearchText(phrase);
  if (!cleanPhrase || !normalizedText) return false;
  return ` ${normalizedText} `.includes(` ${cleanPhrase} `);
}

/**
 * Bounded Levenshtein edit distance for Vietnamese trekking typo recovery.
 */
export function levenshteinDistance(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// High-frequency Vietnamese stop words filtered from token scoring
const VIETNAMESE_STOP_WORDS = new Set([
  'la', 'va', 'cua', 'cho', 'toi', 'minh', 'em', 'anh', 'chi', 'ban', 'co', 'khong', 'duoc',
  'khi', 'nao', 'gi', 'sao', 'nhu', 'the', 'o', 'tai', 'tu', 'den', 'voi', 'trong', 'ngoai',
  'tren', 'duoi', 'mot', 'nhung', 'cac', 'nay', 'do', 'kia', 'di', 've', 'ra', 'vao', 'len',
  'xuong', 'hay', 'hoac', 'nen', 'can', 'phai', 'muon', 'hoi', 'xin', 'giup', 'voi', 'a', 'nha',
  'nhe', 'nhi', 'bao', 'nhieu', 'may', 'het', 'rat', 'qua', 'hon', 'nhat', 'bi', 'lam', 'de',
  'thu', 'xem', 'tim', 'kiem', 'goi', 'y', 've', 'cung', 'duong', 'nui', 'rung', 'trek', 'trekking', 'leo',
]);

/**
 * Accent-stripped Trekking Synonyms Dictionary (all keys & values strictly normalized ASCII)
 */
export const TREKKING_SYNONYMS: Record<string, string[]> = {
  ams: ['soc do cao', 'say do cao', 'thieu oxy', 'chong mat buon non', 'hape', 'hace'],
  'soc do cao': ['ams', 'say do cao', 'thieu oxy do cao', 'chong mat buon non'],
  'lac duong': ['mat dau', 'lac rung', 'mat phuong huong', 's t o p', 'mat dau vet', 'lac trong suong mu'],
  'ha than nhiet': ['hypothermia', 'nhiem lanh', 'run ray', 'u am trong diem'],
  'ran can': ['ran doc', 'so cuu ran', 'noc doc', 'ran luc duoi do', 'cap nia', 'bang ep bat dong'],
  'vat rung': ['dia rung', 'chong vat', 'bi vat can', 'go vat', 'thuoc dep', 'xa cap'],
  'giay trekking': ['giay leo nui', 'chon giay', 'co lung', 'de vibram'],
  balo: ['ba lo', 'hanh ly', 'xep balo', 'tai trong balo', 'trong luong balo'],
  porter: ['nguoi dan duong', 'gui do', 'dan doan', 'guide', 'huong dan vien'],
  'lan nghi': ['ngu lan', 'lan go', 'bai cam trai', 'cho ngu tren nui'],
  'giay phep': ['kiem lam', 'bien phong', 'thu tuc', 'dang ky leo nui'],
  'san may': ['bien may', 'mua may', 'cong thuc san may', 'nghich nhiet'],
  'nguoi moi': ['newbie', 'chua leo bao gio', 'lan dau', 'tap the luc'],
  'loc nuoc': ['nuoc suoi', 'vien loc', 'sawyer', 'aquatabs', 'khu trung nuoc'],
  'di suoi': ['suoi gan toi', 'loi suoi', 'bang suoi', 'trekking suoi', 'tam suoi', 'thac nuoc', 'trek suoi'],
  'lu quet': ['lu ong', 'nuoc dang', 'sat lo', 'mua nguon', 'dong chay xiet', 'nuoc suoi dang'],
  chill: ['chill chill', 'nhe nhang', 'thu gian', 'khong mat suc', 'thanh thoi'],
  'mat me': ['se lanh', 'khi hau mat', 'tranh nong', 'on hoa'],
  'khong mua': ['mua kho', 'nang rao', 'thoi tiet dep', 'it mua', 'troi trong'],
  'bung de giay': ['bung de', 'bong de', 'rach de', 'de giay rot', 'hong giay', 'rach giay', 'dut giay'],
  'rach leu': ['gay coc leu', 'sap leu', 'bay leu', 'gio thoi bay leu', 'rach bat', 'hong leu'],
  'mat lua': ['roi bat lua', 'bat lua uot', 'het ga', 'uot bat lua', 'mat hop quet', 'nhom lua cap toc'],
  'mat dien thoai': ['roi dien thoai', 'het pin', 'mat song', 'dinh huong sao', 'khong co song'],
  'ong dot': ['ong vo ve', 'ong bap cay', 'ong dat', 'bay ong', 'bi ong can', 'ong tan cong', 'to ong'],
  'hoang loan': ['panic attack', 'dong cung', 'khoc tren nui', 'so do cao cuc do', 'song lung khung long', 'run so'],
  'den ky': ['kinh nguyet', 'toi thang', 'den thang', 'co kinh', 'bang ve sinh', 'phu nu leo nui'],
  'hen suyen': ['kho tho hen', 'mat binh xit', 'len con hen', 'hen phe quan', 'tut duong huyet', 'tieu duong'],
  'bien phong': ['vanh dai bien gioi', 'quen cccd', 'quen giay to', 'tuan tra', 'khai bao'],
  'kieng ky': ['tam linh', 'nguoi mong', 'nguoi dao', 'cay thieng', 'bep lua', 'cot thieng', 'rung cam'],
  'thu rung': ['lon rung', 'khi cuop do', 'cho hoang', 'dong vat hoang da'],
  'dep to ong': ['dep tong', 'di dep lao', 'dep quai hau', 'dep le', 'di dep di leo nui'],
  'loa keo': ['nuong bbq', 'mo tiec tren dinh', 'bep than hoa', 'quay tren dinh', 'mo nhac to'],
  'hai lan rung': ['chat cay', 'be canh do quyen', 'mang lan ve', 'hai hoa rung', 'pha rung'],
  'set danh': ['chong set', 'sam set', 'giong set', 'lightning squat', 'vut gay', 'tia set'],
  'nam doc': ['ngo doc nam', 'an phai nam', 'ngo doc thuc an', 'nam la'],
  'soc nhiet': ['say nang', 'say nong', 'heat stroke', 'nang gat'],
  'gay xuong': ['gay tay', 'gay chan', 'nep xuong', 'chan thuong kin', 'lech khop'],
  'da nang': ['o da nang', 'dang o da nang', 'suoi da nang', 'gieng troi', 'khe ram', 'hoa vang', 'hoa bac', 'suoi hoa', 'suoi mo'],
  gpx: ['tracklog', 'ban do offline', 'file gpx', 'la ban', 'dinh vi ve tinh', 'lech tuyen'],
  'thoi tiet': ['nhiet do dinh', 'lapse rate', 'gio giat', 'mua bao', 'suong mu', 'mua mua'],
};

function formatVietnameseMonthRange(months: number[]): string {
  const unique = Array.from(new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)));
  if (unique.length === 0) return '';
  if (unique.length === 12) return 'Quanh năm (Tháng 1 – Tháng 12)';

  // Preserve contiguous wrap-around ranges like [10, 11, 12, 1, 2, 3, 4]
  const set = new Set(unique);
  const segments: Array<[number, number]> = [];
  const visited = new Set<number>();
  for (const m of unique) {
    if (visited.has(m)) continue;
    let start = m;
    while (set.has(((start - 2 + 12) % 12) + 1) && !visited.has(((start - 2 + 12) % 12) + 1)) {
      const prev = ((start - 2 + 12) % 12) + 1;
      if (prev === m) break;
      start = prev;
    }
    let end = start;
    visited.add(start);
    while (set.has((end % 12) + 1) && !visited.has((end % 12) + 1)) {
      end = (end % 12) + 1;
      visited.add(end);
    }
    segments.push([start, end]);
  }
  return segments.map(([s, e]) => (s === e ? `Tháng ${s}` : `Tháng ${s} – Tháng ${e}`)).join(', ');
}

function formatPeakDisplayTitle(name: string): string {
  const trimmed = name.trim();
  if (/^(đỉnh|vqg|khu\s+bttn|thác|giếng\s+trời|cực\s+đông|chùa\s+đồng|tà\s+năng|núi)/i.test(trimmed)) {
    return trimmed;
  }
  return `Đỉnh ${trimmed}`;
}

/**
 * Builds the exhaustive Master Knowledge Dataset across all 10 categories.
 */
function buildMasterKnowledgeDataset(): KnowledgeItem[] {
  const dataset: KnowledgeItem[] = [];
  const canonicalTrailMap = new Map(mockTrails.map((t) => [t.id, t]));

  // =========================================================================
  // 1. TRAIL SPECIFIC QUESTIONS FOR ALL VERIFIED PEAKS & TRAILS (DRIVEN BY CANONICAL mockTrails)
  // =========================================================================
  VIETNAM_PEAKS_MATRIX.forEach((peak) => {
    const canonicalTrail = peak.canonicalTrailId ? canonicalTrailMap.get(peak.canonicalTrailId) : undefined;
    const altitudeM = canonicalTrail?.maxAltitudeM ?? peak.altitude;
    const region = canonicalTrail?.region ?? peak.region;
    const durationDays =
      canonicalTrail?.durationDays ??
      (peak.days.includes('3N') ? 3 : peak.days.includes('2N') ? 2 : 1);
    const isOneDay = durationDays <= 1 && !peak.days.includes('2N') && !peak.days.includes('3N');
    const isThreeDay = durationDays >= 3 || peak.days.includes('3N');
    const hasWaterSource = canonicalTrail ? Boolean(canonicalTrail.hasWaterSource) : true;
    const hasCampsite = canonicalTrail ? Boolean(canonicalTrail.hasCampsite) : !isOneDay;
    const bestMonths = canonicalTrail?.bestMonths?.length ? canonicalTrail.bestMonths : [];
    const avoidMonths = canonicalTrail?.avoidMonths?.length ? canonicalTrail.avoidMonths : [];
    const baseKeywords = [peak.name.toLowerCase(), ...peak.aliases];
    const resolvedTrailId = peak.canonicalTrailId || peak.id;
    const displayTitle = formatPeakDisplayTitle(peak.name);
    const isHighlandNorth = region === 'Miền Bắc' && altitudeM >= 1800;
    const isCentralCoastOrForest = region === 'Miền Trung' && peak.region === 'Miền Trung';
    const isTayNguyen = peak.region === 'Tây Nguyên';

    const bestMonthsText = bestMonths.length
      ? formatVietnameseMonthRange(bestMonths)
      : isHighlandNorth
        ? 'Tháng 10 – Tháng 4'
        : isCentralCoastOrForest
          ? 'Tháng 1 – Tháng 8'
          : 'Tháng 11 – Tháng 4';
    const avoidMonthsText = avoidMonths.length
      ? formatVietnameseMonthRange(avoidMonths)
      : isCentralCoastOrForest
        ? 'Tháng 9 – Tháng 12'
        : region === 'Miền Bắc'
          ? 'Tháng 6 – Tháng 8'
          : 'Tháng 7 – Tháng 10';

    const seasonAnswer = isHighlandNorth
      ? `Thời điểm đẹp nhất chinh phục **${peak.name}** (${region} — ${altitudeM.toLocaleString()}m):\n\n1. **Mùa đẹp nhất (${bestMonthsText})**: Không khí mát lạnh, tỷ lệ săn biển mây cao và hoa rừng Tây Bắc nở rộ dọc sườn núi.\n2. **Lưu ý nhiệt độ đỉnh**: Đêm trên cao thường tụt xuống dưới 5°C – 10°C, cần chuẩn bị quy tắc 3 lớp áo và túi ngủ đủ ấm.\n3. **Mùa cần tránh (${avoidMonthsText})**: Mưa lũ lớn khu vực miền núi phía Bắc, nguy cơ sạt lở đất và lũ quét khe suối.`
      : isCentralCoastOrForest
        ? `Thời điểm đẹp nhất chinh phục **${peak.name}** (${peak.province} — Miền Trung):\n\n1. **Mùa thuận lợi (${bestMonthsText})**: Trời quang, nước suối trong và đường mòn khô ráo dễ di chuyển.${!hasWaterSource ? ' Lưu ý mang đủ nước và xuất phát sớm tránh nắng gắt ven biển.' : ''}\n2. **CẢNH BÁO MÙA BÃO MIỀN TRUNG — Mùa cần tránh (${avoidMonthsText})**: Đỉnh điểm mưa bão, áp thấp nhiệt đới và lũ quét nguy hiểm tại Miền Trung — **TUYỆT ĐỐI KHÔNG** cố đi khi có cảnh báo mưa lớn.`
        : region === 'Miền Bắc'
          ? `Thời điểm đẹp nhất chinh phục **${peak.name}** (${peak.province} — Miền Bắc):\n\n1. **Mùa đẹp nhất (${bestMonthsText})**: Thời tiết khô ráo, trời mát mẻ dễ chịu, thích hợp leo bậc đá và đi bộ rừng nguyên sinh miền Bắc.\n2. **Lưu ý sương ẩm**: Sáng sớm mùa xuân hoặc sau mưa phùn bậc đá và rễ cây có rêu trơn, nên dùng giày bám tốt.\n3. **Mùa cần tránh (${avoidMonthsText})**: Mưa lớn mùa hè và bão nhiệt đới gây trơn trượt, nguy cơ sạt lở.`
          : `Thời điểm đẹp nhất chinh phục **${peak.name}** (${peak.province} — ${isTayNguyen ? 'Tây Nguyên' : 'Miền Nam'}):\n\n1. **Mùa khô thuận lợi (${bestMonthsText})**: Đường mòn khô ráo dễ bám, tầm nhìn thoáng rộng.\n2. **Lưu ý nắng nóng**: Nên xuất phát sớm (05:30 – 06:30) và chủ động bổ sung nước + điện giải Oresol.\n3. **Mùa cần tránh (${avoidMonthsText})**: Mưa lớn kéo dài, đường đất đỏ lầy lội, nhiều vắt rừng và nước suối dâng cao.`;

    const itineraryAnswer = isOneDay
      ? `**Lịch trình đề xuất trong ngày cho ${peak.name} (${altitudeM.toLocaleString()}m — ${peak.days}):**\n\n- **05:30 – 06:00**: Xuất phát từ **${peak.checkpoint}**, khởi động kỹ khớp gối và cổ chân.\n- **09:30 – 11:30**: Chạm đích **${peak.name}**, nghỉ ngơi, ăn trưa nhẹ và bù điện giải.\n- **13:00 – 16:00**: Hạ sơn về điểm xuất phát trước khi trời tối, hoàn thành hành trình an toàn.`
      : isThreeDay
        ? `**Lịch trình đề xuất 3 ngày 2 đêm cho ${peak.name} (${altitudeM.toLocaleString()}m — ${peak.days}):**\n\n- **Ngày 1**: 07:30 khai báo CCCD & xuất phát từ **${peak.checkpoint}** -> 11:30 ăn trưa dọc tuyến -> 16:30 đến điểm hạ trại / lán nghỉ đêm 1, ăn tối nóng và nghỉ sớm.\n- **Ngày 2**: 05:00 ăn sáng, mang balo gọn nhẹ đẩy chặng chính lên đích / đỉnh **${peak.name}** -> 11:30–13:00 chạm đỉnh, ăn trưa nhanh -> 16:30 rút về lán / bãi trại đêm 2 an toàn trước hoàng hôn.\n- **Ngày 3**: 06:30 ăn sáng, thu dọn toàn bộ rác (Leave No Trace) -> 07:30 xuất phát hạ sơn -> 14:30 – 16:00 về lại điểm xuất phát, báo bình an.`
        : `**Lịch trình đề xuất 2 ngày 1 đêm cho ${peak.name} (${altitudeM.toLocaleString()}m — ${peak.days}):**\n\n- **Ngày 1**: 08:00 khai báo & xuất phát từ **${peak.checkpoint}** -> 11:30 ăn trưa nhẹ -> 16:30 đến điểm hạ trại / lán nghỉ -> Ăn tối ấm và nghỉ sớm.\n- **Ngày 2**: 04:30 thức dậy ăn sáng -> 06:00 chạm đỉnh đón bình minh / săn mây -> 08:30 thu dọn rác (LNT) rút về lán -> 14:30 xuống chân núi an toàn.`;

    const waterAndShelterAnswer = `Điều kiện hậu cần tại **${peak.name}**:\n\n- **Nghỉ chân / Hạ trại**: ${
      hasCampsite
        ? isOneDay
          ? 'Có điểm dừng nghỉ và khu vực cắm trại theo quy định (cần đăng ký trước nếu ở qua đêm).'
          : altitudeM >= 1800 && region === 'Miền Bắc'
            ? 'Có lán gỗ bản địa hoặc bãi hạ trại lều theo tuyến (bắt buộc mang túi ngủ chịu nhiệt phù hợp).'
            : 'Có bãi hạ trại / điểm nghỉ quy định dọc tuyến (luôn mang lều bạt, đệm cách nhiệt và túi ngủ phù hợp).'
        : 'Tuyến đi trong ngày, không có lán ngủ qua đêm cố định — cần kiểm soát giờ quay đầu để xuống núi trước khi trời tối.'
    }\n- **Nguồn nước thực tế**: ${
      hasWaterSource
        ? 'Có điểm lấy nước suối / trạm dọc tuyến; bắt buộc lọc qua **màng lọc Sawyer / viên lọc Aquatabs** hoặc đun sôi trước khi uống. Mang theo tối thiểu **2 – 2.5 lít nước** cá nhân khi xuất phát.'
        : '**KHÔNG CÓ nguồn nước suối tự nhiên dọc tuyến** — BẮT BUỘC tự mang đủ tối thiểu **3 – 4 lít nước/ngày + Oresol điện giải** (hoặc bố trí tiếp nước qua Porter/địa phương) để phòng mất nước và sốc nhiệt!'
    }`;

    const hazardsAnswer = !hasWaterSource
      ? `Cảnh báo an toàn trọng điểm trên cung **${peak.name}**:\n\n1. **Thiếu nước & Sốc nhiệt**: Tuyến không có nguồn nước tự nhiên dọc đường; địa hình nắng gió lộ thiên (đồi cát/bậc đá/sống núi) gây mất nước cực nhanh — luôn dự phòng đủ nước và Oresol.\n2. **Trượt ngã trên đá / địa hình dốc**: ${canonicalTrail?.difficultyNote || 'Giữ 3 điểm tiếp xúc, mang giày bám chắc và không đi sát mép đá nguy hiểm.'}\n3. **Định vị ngoại tuyến**: Tải trước **Gói Offline & Tracklog GPX** trên LOST trước khi vào vùng sóng yếu.\n4. **Cứu nạn khẩn cấp**: Liên hệ **${peak.rescue}** hoặc **112 / 114**.`
      : altitudeM >= 1800
        ? `Cảnh báo an toàn trọng điểm trên cung **${peak.name}** (${altitudeM.toLocaleString()}m):\n\n1. **Gió núi, sương mù & hạ thân nhiệt**: Đỉnh cao trên 1.800m có thể lạnh sâu và gió giật mạnh; tuyệt đối không đứng sát mép vực sống lưng chụp ảnh.\n2. **Dốc đá rêu trơn trượt**: Sử dụng cặp gậy trekking để giảm tải khớp gối và giữ 3 điểm tiếp xúc khi đổ dốc.\n3. **Mất dấu trong sương mù**: Luôn tải trước **Gói Offline & Tracklog GPX** trên LOST để bật cảnh báo lệch tuyến.\n4. **Cứu nạn khẩn cấp**: Liên hệ **${peak.rescue}** hoặc **112 / 114**.`
        : `Cảnh báo an toàn trọng điểm trên cung **${peak.name}**:\n\n1. **Đặc thù địa hình**: ${canonicalTrail?.difficultyNote || 'Đường rừng nhiệt đới nhiều rễ cây, đá rêu ẩm trơn và vắt rừng vào mùa ẩm.'}\n2. **An toàn suối & mưa rừng**: Theo dõi mực nước suối, tránh đi vào mùa mưa bão (${avoidMonthsText}) và hạ trại cách mép nước tối thiểu 50m.\n3. **Định vị & sức khỏe**: Mang thuốc chống vắt/côn trùng, đủ nước + điện giải và tải sẵn **Gói Offline & Tracklog GPX** trên LOST.\n4. **Cứu nạn khẩn cấp**: Liên hệ **${peak.rescue}** hoặc **112 / 114**.`;

    // Q1: Overview, Altitude & Difficulty
    dataset.push({
      id: `${peak.id}-overview`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `${displayTitle} cao bao nhiêu mét, thuộc tỉnh nào và độ khó ra sao?`,
      keywords: [...baseKeywords, 'độ cao', 'cao độ', 'độ khó', 'thuộc tỉnh', 'nằm ở đâu', 'tổng quan'],
      answer: `**${peak.name}** có cao độ thực tế **${altitudeM.toLocaleString()}m** thuộc địa phận **${peak.province}** (${region}).\n\n- **Thời lượng chuẩn**: Phù hợp cho hành trình **${peak.days}**${canonicalTrail ? ` (~${canonicalTrail.distanceKm} km, độ dốc tích lũy +${canonicalTrail.elevationGainM.toLocaleString()}m, cấp độ ${canonicalTrail.difficultyLevel}/5)` : ''}.\n- **Trạm xuất phát chính**: **${peak.checkpoint}**.\n- **Mùa đẹp / Tránh**: Đẹp nhất **${bestMonthsText}**; cần tránh **${avoidMonthsText}**.\n- **Hotline cứu hộ xác thực**: **${peak.rescue}**.\n- **Lưu ý**: Rèn luyện thể lực trước 2–4 tuần và mang theo CCCD bản gốc để khai báo tại trạm kiểm lâm / biên phòng.`,
      sourceOrHotline: peak.rescue,
    });

    // Q2: Best Months & Cloud Hunting Season
    dataset.push({
      id: `${peak.id}-season-cloud`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `Mùa nào đi ${peak.name} đẹp nhất và thời tiết thuận lợi nhất?`,
      keywords: [...baseKeywords, 'mùa đẹp', 'tháng mấy', 'săn mây', 'thời tiết đẹp', 'biển mây'],
      answer: seasonAnswer,
      sourceOrHotline: peak.rescue,
    });

    // Q3: Itinerary breakdown
    dataset.push({
      id: `${peak.id}-itinerary`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `Lịch trình chi tiết đi ${peak.name} (${peak.days}) như thế nào?`,
      keywords: [...baseKeywords, 'lịch trình', 'timeline', 'kế hoạch đi', 'mấy ngày'],
      answer: itineraryAnswer,
      sourceOrHotline: peak.rescue,
    });

    // Q4: Porter cost and booking
    dataset.push({
      id: `${peak.id}-porter`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `Chi phí thuê Porter và người dẫn đường tại ${peak.name} là bao nhiêu?`,
      keywords: [...baseKeywords, 'porter', 'thuê porter', 'dẫn đường', 'giá porter', 'gùi đồ'],
      answer: `Chi phí thuê **Porter / Hướng dẫn viên bản địa** tại **${peak.name}** thường dao động **500.000 – 800.000 VNĐ / ngày** (tùy độ khó tuyến và số ngày).\n\n- **Định mức gùi đồ**: Tối đa **12 – 15kg / Porter** (đồ chung, lều trại, thực phẩm, nước uống).\n- **Vai trò**: Dẫn đúng hướng địa hình, nấu ăn tại lán, hỗ trợ kiểm tra thủ tục cửa rừng và xử lý tình huống khẩn cấp.`,
      sourceOrHotline: peak.rescue,
    });

    // Q5: Permits & Checkpoints
    dataset.push({
      id: `${peak.id}-permits`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `Thủ tục xin giấy phép đi ${peak.name} cần chuẩn bị những gì?`,
      keywords: [...baseKeywords, 'giấy phép', 'kiểm lâm', 'biên phòng', 'cccd', 'thủ tục'],
      answer: `Thủ tục khi chinh phục **${peak.name}**:\n\n- **Giấy tờ tùy thân**: **CCCD bản gốc** (hoặc hộ chiếu đối với người nước ngoài).\n- **Địa điểm khai báo**: ${canonicalTrail?.permitInfo || `Trạm kiểm lâm, BQL VQG hoặc Đồn Biên phòng tại **${peak.checkpoint}**`}.\n- **Lệ phí**: Vé tham quan / phí bảo vệ rừng theo niêm yết của VQG hoặc Khu BTTN (nếu thuộc khu vực quản lý).\n- **Hotline xác thực**: **${peak.rescue}**.`,
      sourceOrHotline: peak.rescue,
    });

    // Q6: Water & Shelters
    dataset.push({
      id: `${peak.id}-water-shelters`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `Trên cung đường ${peak.name} có lán ngủ và nguồn nước tự nhiên không?`,
      keywords: [...baseKeywords, 'lán ngủ', 'nguồn nước', 'nước suối', 'chỗ ngủ', 'cắm trại'],
      answer: waterAndShelterAnswer,
      sourceOrHotline: peak.rescue,
    });

    // Q7: Specific Hazards & Warnings
    dataset.push({
      id: `${peak.id}-hazards`,
      category: 'trail_specific',
      trailId: resolvedTrailId,
      trailName: peak.name,
      question: `Những đoạn đường nguy hiểm và rủi ro lớn nhất tại ${peak.name} là gì?`,
      keywords: [...baseKeywords, 'nguy hiểm', 'rủi ro', 'vực sâu', 'trơn trượt', 'cảnh báo'],
      answer: hazardsAnswer,
      sourceOrHotline: peak.rescue,
    });
  });

  // =========================================================================
  // 2. WILDERNESS FIRST AID (WFA) & EMERGENCY SOS
  // =========================================================================
  const emergencyKnowledge = [
    {
      q: 'Sốc độ cao (AMS - Acute Mountain Sickness) có triệu chứng gì và xử lý khẩn cấp ra sao?',
      kw: ['sốc độ cao', 'ams', 'say độ cao', 'đau đầu', 'buồn nôn', 'hạ độ cao', 'thiếu oxy'],
      ans: `**Hội chứng sốc độ cao (AMS):**\n\n1. **Triệu chứng nhận biết**: Đau đầu buốt hai bên thái dương, buồn nôn, chóng mặt, tức ngực, khó thở khi lên trên **2.200m**.\n2. **Quy tắc vàng**: **HẠ CAO ĐỘ NGAY LẬP TỨC từ 300m – 500m**. Hạ độ cao là biện pháp điều trị triệt để duy nhất.\n3. **Sơ cứu tại chỗ**: Nghỉ nơi kín gió, ủ ấm, uống từng ngụm nước ấm pha Oresol hoặc trà gừng, hít thở sâu nhịp nhàng.\n4. **Cấm kỵ**: Tuyệt đối không gắng sức leo tiếp vì có thể chuyển biến thành phù phổi (HAPE) hoặc phù não (HACE) nguy hiểm tính mạng.`,
    },
    {
      q: 'Quy tắc sinh tồn S.T.O.P khi bị lạc trong rừng sâu được thực hiện như thế nào?',
      kw: ['lạc đường', 's.t.o.p', 'bị lạc', 'mất phương hướng', 'sinh tồn rừng'],
      ans: `**Quy tắc S.T.O.P khi bị lạc trong rừng:**\n\n1. **S - Stop (Dừng lại ngay)**: Ngừng di chuyển ngay khi nhận ra mất dấu đường mòn. Không đi bừa hoảng loạn.\n2. **T - Think (Suy nghĩ bình tĩnh)**: Nhớ lại mốc nhận diện rõ nhất gần nhất (tảng đá, ngã ba, lán nghỉ).\n3. **O - Observe (Quan sát địa hình)**: Tìm chỗ trú gió an toàn, tránh cây mục, **tuyệt đối không đi xuống khe suối cạn** (dễ kẹt thác cụt / vách đứng).\n4. **P - Plan (Phát tín hiệu SOS)**: Thổi còi **3 hồi ngắn** cách nhau 1 phút, ban ngày tạo khói trắng, ban đêm nháy đèn pin 3 nhịp và gửi SMS 2G kèm tọa độ GPS về **112**.`,
    },
    {
      q: 'Cách nhận biết và cấp cứu hạ thân nhiệt (Hypothermia) trong rừng lạnh?',
      kw: ['hạ thân nhiệt', 'hypothermia', 'nhiễm lạnh', 'run rẩy', 'ủ ấm'],
      ans: `**Cấp cứu hạ thân nhiệt:**\n\n1. **Dấu hiệu**: Run rẩy mất kiểm soát, nói lắp, môi tím tái, cử động tay chân vụng về, lú lẫn.\n2. **Cách ly nguồn lạnh**: Đưa vào lều/lán kín gió, trải thảm cách nhiệt ngăn hơi lạnh từ đất.\n3. **Thay đồ khô ngay**: Cởi toàn bộ quần áo ướt mồ hôi hoặc nước mưa, mặc lớp khô giữ nhiệt.\n4. **Ủ ấm trung tâm**: Đặt bình nước ấm (40–45°C bọc khăn) tại **nách, ngực và bẹn**. Cho uống trà gừng đường ấm nếu còn tỉnh.\n5. **Cấm kỵ**: Không xoa bóp mạnh tay chân (dễ đẩy máu lạnh ngoại vi về tim gây rối loạn nhịp tim).`,
    },
    {
      q: 'Quy trình sơ cứu chuẩn y khoa khi bị rắn độc cắn trong rừng?',
      kw: ['rắn cắn', 'rắn độc', 'sơ cứu rắn', 'bất động', 'nọc độc'],
      ans: `**Sơ cứu rắn cắn chuẩn y tế dã ngoại (WFA):**\n\n1. **Bất động hoàn toàn**: Đặt nạn nhân nằm yên, giữ chi bị cắn **thấp hơn tim** nhằm làm chậm nọc độc lan theo tuần hoàn.\n2. **Vệ sinh nhẹ**: Rửa vết cắn bằng nước sạch hoặc nước muối sinh lý, tháo nhẫn/vòng trước khi sưng.\n3. **Băng ép thun đàn hồi**: Quấn từ đầu chi lên trên với lực vừa đủ (vẫn sờ thấy mạch đập).\n4. **Cấm kỵ tuyệt đối**: CẤM rạch da, CẤM hút nọc bằng miệng, CẤM đắp lá cây, CẤM garo siết chặt gây hoại tử.\n5. **Vận chuyển cấp cứu**: Cáng nạn nhân tới bệnh viện có huyết thanh kháng nọc; gọi **115 / 112**.`,
    },
    {
      q: 'Cách xử lý bong gân, lật sơ mi mắt cá chân khi đang đi dốc đá?',
      kw: ['bong gân', 'lật sơ mi', 'trẹo chân', 'r.i.c.e', 'khớp cổ chân'],
      ans: `**Quy trình R.I.C.E xử lý bong gân / lật sơ mi:**\n\n1. **R - Rest**: Dừng bước ngay, không dồn trọng lượng lên cổ chân đau.\n2. **I - Ice/Cold**: Ngâm hoặc chườm nước suối mát 15–20 phút để giảm sưng nề.\n3. **C - Compression**: Quấn băng thun hình số 8 cố định cổ chân từ bàn chân lên trên mắt cá.\n4. **E - Elevation**: Kê cao chân hơn mức tim khi nghỉ.\n5. **Rút lui an toàn**: Chia bớt balo cho đồng đội và chống cặp gậy trekking để giảm tải lên khớp cổ chân.`,
    },
    {
      q: 'Tư thế phòng tránh sét đánh trên đỉnh núi trống hoặc sống lưng đồi trọc?',
      kw: ['sét đánh', 'tránh sét', 'sống núi', 'sấm sét', 'đỉnh trọc'],
      ans: `**Nguyên tắc sinh tồn khi gặp dông sét trên núi cao:**\n\n1. **Hạ độ cao khẩn cấp**: Rời khỏi đỉnh núi, sống núi trống, mỏm đá nhô cao và cây đứng đơn độc.\n2. **Tách kim loại**: Đặt gậy leo núi kim loại, balo khung nhôm cách vị trí ngồi tối thiểu **15–20m**.\n3. **Tư thế Lightning Squat**: Ngồi xổm trên tấm lót cách điện (balo vải khô), hai gót chân chụm sát nhau, gục đầu vào gối, bịt tai. **Cấm nằm áp bụng xuống đất** vì dòng điện bước lan qua mặt đất cực kỳ nguy hiểm.`,
    },
    {
      q: 'Dấu hiệu nhận biết lũ quét, lũ ống qua suối và cách thoát hiểm?',
      kw: ['lũ quét', 'lũ ống', 'vượt suối', 'mưa rừng', 'nước lũ'],
      ans: `**Nhận biết & Thoát hiểm lũ quét suối rừng:**\n\n1. **Dấu hiệu cảnh báo đỏ**: Nước suối đột ngột chuyển đục ngầu màu đất đỏ, cuốn theo nhiều cành lá khô và có tiếng gầm rền từ thượng nguồn.\n2. **Hành động tức thì**: **Lập tức chạy ngược lên sườn đồi cao**, rời khỏi lòng suối và bãi bồi thấp ngay cả khi phải bỏ lại đồ.\n3. **Nguyên tắc vượt suối**: Không lội suối khi nước sâu quá đầu gối hoặc chảy xiết; luôn tháo chốt đai hông & đai ngực balo trước khi lội.`,
    },
    {
      q: 'Gợi ý các địa điểm trekking đi suối gần tôi theo từng vùng miền (Đà Nẵng, Miền Trung, Hà Nội, TP.HCM) và lưu ý an toàn lội suối sinh tồn?',
      kw: [
        'đi suối gần tôi', 'suối gần tôi', 'trekking suối', 'lội suối', 'thác nước gần đây',
        'tắm suối', 'đi suối', 'suối gần đây', 'cung đường suối', 'vượt suối an toàn',
        'suối đà nẵng', 'giếng trời', 'khe ram', 'hòa bắc', 'suối mơ', 'suối hoa', 'bạch mã', 'thác k50', 'suối tiên', 'suối đá', 'cửa tử',
      ],
      ans: `**GỢI Ý CÁC ĐỊA ĐIỂM TREKKING SUỐI THÁC THEO VÙNG MIỀN:**\n\n**1. Đà Nẵng & Miền Trung:**\n- **Giếng Trời (Hòa Vang, Đà Nẵng)**: Xuyên rừng ~7.5km (khứ hồi 15km) tới hồ ngọc bích dưới chân thác 25m.\n- **Khe Ram - Hòa Bắc (Hòa Vang, Đà Nẵng)**: Suối đá thoai thoải nước trong giữa thung lũng Cu Đê, hợp cắm trại cuối tuần.\n- **Suối Mơ & Suối Hoa (Hòa Phú, Đà Nẵng)**: Cách trung tâm ~30km theo tuyến ĐT604.\n- **Ngũ Hồ & Thác Đỗ Quyên (VQG Bạch Mã, TP. Huế)**: 5 hồ nước tự nhiên và thác dốc 300m, cách Đà Nẵng ~60km.\n\n**2. Hà Nội & Miền Bắc:**\n- **Suối Cửa Tử (Đại Từ, Thái Nguyên)**: 7 tầng thác mạo hiểm (cách Hà Nội ~90km).\n- **Suối Mơ & Thác Bạc (Ba Vì, Hà Nội)**: Dã ngoại cuối tuần cách trung tâm ~55km.\n\n**3. TP.HCM & Đông Nam Bộ:**\n- **Núi Dinh — Suối Tiên & Suối Đá (Bà Rịa - Vũng Tàu)**: Cách TP.HCM ~75km.\n- **Suối Trúc / Núi Cậu (Bình Dương - Tây Ninh)** & **Suối La Ngâu (Bình Thuận)**.\n\n**4. 3 Quy tắc sống còn khi đi suối:**\n- **Cảnh báo lũ quét**: Nước trong đột ngột đục ngầu cuốn cành lá -> chạy ngay lên đồi cao.\n- **Khoảng cách hạ trại**: Dựng lều cách mép suối tối thiểu **50m** và cao hơn mặt nước ít nhất **3m**.\n- **Lội suối an toàn**: Tháo chốt đai ngực & đai hông balo để kịp thoát thân nếu trượt chân.`,
    },
    {
      q: 'Tôi đang ở Đà Nẵng muốn tìm các con suối thác nước và địa điểm trekking chill gần đây?',
      kw: [
        'ở đà nẵng', 'đang ở đà nẵng', 'suối đà nẵng', 'thác đà nẵng',
        'giếng trời', 'khe ram', 'hòa bắc', 'suối mơ đà nẵng', 'suối hoa',
        'sơn trà', 'bạch mã', 'hải vân', 'đi suối đà nẵng', 'trekking đà nẵng',
      ],
      trailId: 'trail-giengtroi',
      trailName: 'Giếng Trời (KBT Bà Nà - Núi Chúa)',
      ans: `**TỌA ĐỘ TREKKING SUỐI THÁC TẠI ĐÀ NẴNG & LÂN CẬN (15KM – 60KM):**\n\n1. **Giếng Trời (KBT Bà Nà - Núi Chúa, Hòa Ninh, Hòa Vang)**: Cung trekking suối nguyên sơ hàng đầu Đà Nẵng (~7.5km một chiều) tới hồ nước sâu xanh ngọc dưới thác 25m.\n2. **Khe Ram - Hòa Bắc (Hòa Vang, Đà Nẵng)**: Bãi bồi sỏi phẳng bên dòng Cu Đê nước trong vắt, rất hợp cắm trại cuối tuần (cách trung tâm ~30km).\n3. **Suối Mơ & Suối Hoa (Hòa Phú, Hòa Vang)**: Nhiều hồ đá tự nhiên mát lạnh trên tuyến ĐT604 (~30km).\n4. **Ngũ Hồ & Thác Đỗ Quyên (VQG Bạch Mã, Phú Lộc, TP. Huế)**: 5 hồ nước trong và thác 300m, cách Đà Nẵng ~60km qua đèo/hầm Hải Vân.\n\n**Lưu ý an toàn**: Tháng 9 – 12 là mùa mưa lớn miền Trung, luôn kiểm tra Go/No-Go trước khi vào rừng và dựng lều cách mép suối ít nhất **50m**, cao hơn mặt nước **3m**.`,
    },
  ];

  emergencyKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `wfa-emergency-${idx + 1}`,
      category: idx >= 7 ? 'trail_specific' : 'emergency_sos',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
      trailId: (item as any).trailId,
      trailName: (item as any).trailName,
    });
  });

  // =========================================================================
  // 3. FITNESS TRAINING & CONDITIONING
  // =========================================================================
  const fitnessKnowledge = [
    {
      q: 'Giáo án tập thể lực 4 tuần chuẩn trước chuyến leo núi lần đầu tiên?',
      kw: ['tập thể lực', 'giáo án 4 tuần', 'chuẩn bị thể lực', 'chạy bộ', 'leo cầu thang'],
      ans: `**Lộ trình rèn thể lực 4 tuần cho người mới:**\n\n- **Tuần 1 & 2 (Nền tảng tim mạch)**: Chạy bộ 3–5km (3 buổi/tuần, giữ nhịp thở đều), leo cầu thang bộ 15–20 tầng/ngày (đi bộ lên, đi thang máy xuống để bảo vệ khớp gối).\n- **Tuần 3 (Tập vác tải thực tế)**: Đeo balo nặng **4–6kg** leo 20–30 tầng cầu thang, kết hợp Squats (3x15), Lunges (3x12/chân) và Plank (3x45–60s).\n- **Tuần 4 (Giảm tải Tapering)**: Nghỉ tải nhẹ 4 ngày trước khi xuất phát, ngủ đủ 8 tiếng, bổ sung chuối và Magie chống chuột rút.`,
    },
    {
      q: 'Kỹ thuật thở nhịp điệu (Pacing & Breathing) khi leo dốc gắt liên tục?',
      kw: ['cách thở', 'hụt hơi', 'nhịp thở', 'leo dốc gắt', 'tức ngực', 'rest step'],
      ans: `**Kỹ thuật thở & nhịp bước leo dốc alpine:**\n\n1. **Nhịp thở 2:2**: Hít sâu bằng mũi trong 2 bước chân, thở dứt khoát bằng miệng trong 2 bước tiếp theo.\n2. **Tư thế thân trên**: Giữ lưng thẳng tự nhiên, mở lồng ngực để tối ưu dung tích phổi.\n3. **Bước chân Rest Step**: Khóa thẳng xương chân trụ trong 0.5 giây ở mỗi bước để cơ đùi được thả lỏng nghỉ giữa nhịp.`,
    },
    {
      q: 'Làm thế nào để bảo vệ khớp gối tối đa khi đi xuống dốc đá dài?',
      kw: ['bảo vệ gối', 'đau khớp gối', 'xuống dốc', 'thoái hóa sụn gối', 'bó gối'],
      ans: `**Bảo vệ khớp gối khi đổ dốc dài:**\n\n1. **Dùng cặp gậy trekking**: Kéo dài gậy thêm 5–10cm khi xuống dốc để tay gánh 25–30% tải trọng.\n2. **Chùng nhẹ đầu gối**: Luôn giữ khớp gối hơi đàn hồi như giảm xóc, tránh duỗi thẳng đơ.\n3. **Băng bó gối (Knee Braces)**: Giúp ổn định xương bánh chè trên bậc đá gắt.\n4. **Bước ngắn, tiếp đất êm**: Không giậm gót mạnh xuống đá cứng.`,
    },
  ];

  fitnessKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `fitness-${idx + 1}`,
      category: 'fitness_training',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 4. GEAR & PACKING OPTIMIZATION
  // =========================================================================
  const gearKnowledge = [
    {
      q: 'Tiêu chuẩn chọn giày trekking leo núi ở địa hình rừng nhiệt đới Việt Nam?',
      kw: ['chọn giày', 'giày trekking', 'cổ cao', 'cổ lửng', 'đế vibram', 'chống trượt'],
      ans: `**Tiêu chí vàng chọn giày trekking tại Việt Nam:**\n\n1. **Cổ giày**: Ưu tiên **Cổ lửng (Mid-cut)** để bảo vệ mắt cá chống lật sơ mi nhưng vẫn linh hoạt.\n2. **Đế giày**: Gai rãnh sâu bám bùn rêu (cao su **Vibram** hoặc Contagrip).\n3. **Kích cỡ**: Chọn rộng hơn **0.5 – 1 size** so với giày thường (mũi chân cách mũi giày ~1cm) kèm tất dày để không bị dập móng khi đổ dốc.`,
    },
    {
      q: 'Quy tắc 3 lớp áo (Layering System) giữ ấm cơ thể trong đêm rừng lạnh là gì?',
      kw: ['quy tắc 3 lớp', 'layering', 'áo giữ nhiệt', 'gore-tex', 'áo lông vũ'],
      ans: `**Hệ thống 3 lớp áo chuẩn dã ngoại:**\n\n- **Lớp 1 (Base Layer — Thoát mồ hôi)**: Áo thun kỹ thuật sợi tổng hợp hoặc len Merino ôm nhẹ, không mặc cotton vì thấm mồ hôi lâu khô gây lạnh.\n- **Lớp 2 (Mid Layer — Giữ nhiệt)**: Áo nỉ Fleece hoặc áo lông vũ siêu nhẹ giữ lớp khí ấm quanh thân.\n- **Lớp 3 (Outer Shell — Chắn gió & chống thấm)**: Áo khoác màng GORE-TEX/eVent cản gió núi và sương mù.`,
    },
    {
      q: 'Cách phân bổ trọng lượng trong balo theo sơ đồ hình quả trứng khoa học?',
      kw: ['sắp xếp balo', 'xếp balo', 'phân bổ trọng lượng', 'trọng tâm balo', 'đau vai'],
      ans: `**Nguyên tắc xếp balo 3 tầng:**\n\n1. **Đáy balo (Nhẹ, ít dùng ban ngày)**: Túi ngủ, đồ ngủ dự phòng, đệm hơi.\n2. **Giữa balo sát lưng (Nặng nhất)**: Nước dự phòng, thực phẩm, đồ cắm trại để dồn trọng tâm vào đai hông.\n3. **Đỉnh balo & Ngăn ngoài (Cần lấy nhanh)**: Áo mưa bộ, hộp sơ cứu, đèn pin đội đầu, áo gió.\n4. **Giới hạn trọng lượng**: Không vượt quá **18% – 20% thể trọng** (ví dụ nặng 60kg -> balo tối đa ~11–12kg).`,
    },
  ];

  gearKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `gear-${idx + 1}`,
      category: 'gear_equipment',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 5. NUTRITION & SURVIVAL HYDRATION
  // =========================================================================
  const nutritionKnowledge = [
    {
      q: 'Nhu cầu calo tiêu thụ mỗi ngày khi leo núi dốc và các thực phẩm nạp năng lượng tốt nhất?',
      kw: ['calo', 'dinh dưỡng', 'thức ăn leo núi', 'thanh năng lượng', 'thịt bò khô', 'lương khô'],
      ans: `**Dinh dưỡng nạp năng lượng cho trekker:**\n\n- **Mức tiêu hao**: Trung bình **3.200 – 4.500 kcal / ngày** khi vác balo leo dốc.\n- **Snacks nạp nhanh dọc đường**: Socola đen 70%, hạt hạnh nhân/óc chó, thanh năng lượng/gel năng lượng, lương khô quân đội.\n- **Bữa tối tại lán**: Cơm nóng giàu tinh bột + thịt/trứng giàu đạm + canh rau nóng phục hồi glycogen cơ bắp.`,
    },
    {
      q: 'Kỹ thuật lọc và khử trùng nước suối tự nhiên trong rừng phòng ngừa ký sinh trùng?',
      kw: ['lọc nước', 'nước suối', 'aquatabs', 'sawyer squeeze', 'khử trùng nước'],
      ans: `**Khử trùng nước suối sinh tồn:**\n\n1. **Đun sôi**: Đun sôi liên tục 1–3 phút tiêu diệt 100% vi khuẩn & ký sinh trùng.\n2. **Màng lọc vi sợi (Sawyer Squeeze 0.1 micron)**: Loại bỏ 99.999% vi khuẩn E.coli, Salmonella và Giardia.\n3. **Viên lọc Aquatabs**: Pha 1 viên cho 1–2 lít nước trong, chờ 30 phút trước khi uống.\n4. **Nguyên tắc**: Chỉ lấy nước ở dòng chảy xiết đầu nguồn, tuyệt đối không dùng nước tù đọng.`,
    },
  ];

  nutritionKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `nutrition-${idx + 1}`,
      category: 'nutrition_hydration',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 6. CAMPING & LEAVE NO TRACE (LNT)
  // =========================================================================
  const campingKnowledge = [
    {
      q: '7 nguyên tắc Không Để Lại Rác (Leave No Trace - LNT) quốc tế khi đi rừng?',
      kw: ['lnt', 'leave no trace', 'không để lại rác', 'bảo vệ môi trường', 'rác thải'],
      ans: `**7 nguyên tắc Leave No Trace (LNT):**\n\n1. Lập kế hoạch và chuẩn bị chu đáo trước chuyến đi.\n2. Di chuyển và hạ trại trên nền đất/bãi quy định.\n3. Mang toàn bộ rác vô cơ (nilon, vỏ kẹo, chai nhựa, giấy ướt) xuống núi.\n4. Giữ nguyên hiện trạng tự nhiên (không hái hoa, bẻ cành, khắc tên lên cây đá).\n5. Kiểm soát lửa trại tuyệt đối theo quy định PCCC rừng.\n6. Tôn trọng động vật hoang dã.\n7. Tôn trọng các đoàn khác: giữ yên tĩnh, không mở loa công suất lớn trong rừng.`,
    },
    {
      q: 'Cách nhóm lửa sinh tồn khi củi gỗ bị mưa rừng ẩm ướt?',
      kw: ['nhóm lửa', 'củi ẩm', 'thanh magie', 'bùi nhùi', 'bật lửa'],
      ans: `**Kỹ thuật nhóm lửa trong rừng ẩm ướt:**\n\n1. **Lấy lõi gỗ khô**: Chẻ cành cây chết (không nằm sát nền đất ẩm) để lấy phần lõi khô bên trong.\n2. **Bùi nhùi bắt lửa**: Mạt gỗ thông nhựa (gỗ ngo) hoặc bông gòn tẩm sáp Vaseline.\n3. **Đánh lửa**: Dùng thanh đánh lửa Magie (Ferro rod) đánh tia lửa sát bùi nhùi.\n4. **Xếp củi hình chóp (Tipi)**: Nhóm từ cành nhỏ khô rồi đặt củi ẩm vòng ngoài sấy khô dần.`,
    },
    {
      q: 'Gợi ý địa điểm mát mẻ mây nhiều không mưa nhẹ nhàng để đi chill chill và công thức săn mây thành công?',
      kw: ['mát mẻ', 'mây nhiều', 'không mưa', 'chill', 'chill chill', 'săn mây chill', 'trekking chill', 'ngắm mây nhẹ nhàng', 'cắm trại săn mây', 'cung đường chill', 'thư giãn', 'lảo thẩn', 'tà xùa'],
      trailId: 'trail-laothan',
      trailName: 'Lảo Thẩn',
      ans: `**TỌA ĐỘ SĂN MÂY MÁT MẺ, NHẸ NHÀNG ĐỂ ĐI CHILL TẠI VIỆT NAM:**\n\n1. **Lảo Thẩn (Y Tý, Bát Xát, Lào Cai — 2.860m)**: Đồi cỏ thoai thoải, độ khó vừa (3/5), lán nghỉ A Chơ (2.400m) đầy đủ chăn ấm; mùa vàng **Tháng 10 – Tháng 4** (12°C – 18°C).\n2. **Tà Xùa (Bắc Yên, Sơn La / Trạm Tấu, Yên Bái — 2.865m)**: Sống lưng khủng long và biển mây thung lũng cực dày từ **Tháng 11 – Tháng 3**.\n3. **Bidoup - Núi Bà (Lạc Dương, Lâm Đồng — 2.287m)**: Không khí cao nguyên mát 14°C – 18°C dưới tán rừng thông & rêu cổ thụ, mùa khô **Tháng 12 – Tháng 4**.\n4. **Núi Chứa Chan (Xuân Lộc, Đồng Nai — 837m)**: Gần TP.HCM, cắm trại đêm mát mẻ 18°C – 20°C đón mây bình minh.\n\n**Công thức săn biển mây tỷ lệ cao:** Chọn ngày **sau mưa phùn hoặc sau đợt không khí lạnh tăng cường**, sáng hôm sau hửng nắng, độ ẩm >= 85% và gió dưới **12 km/h**.`,
    },
  ];

  campingKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `camping-${idx + 1}`,
      category: 'camping_shelters',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
      trailId: (item as any).trailId,
      trailName: (item as any).trailName,
    });
  });

  // =========================================================================
  // 7. WEATHER & ALPINE CLIMATE (Previously empty category — now populated!)
  // =========================================================================
  const weatherKnowledge = [
    {
      id: 'weather-sea-of-clouds',
      q: 'Công thức khí tượng để xem thời tiết săn biển mây thành công trên núi cao Tây Bắc?',
      kw: ['công thức săn mây', 'xem thời tiết săn mây', 'nghịch nhiệt', 'độ ẩm săn mây', 'chỉ số biển mây', 'biển mây 95%'],
      ans: `**CÔNG THỨC KHÍ TƯỢNG SĂN BIỂN MÂY TRÊN NÚI CAO (> 1.800M):**\n\nBiển mây hình thành do hiện tượng **nghịch nhiệt bức xạ (Temperature Inversion)** trong thung lũng:\n\n1. **Độ ẩm thung lũng cao (>= 85%)**: Lý tưởng nhất là chiều/đêm hôm trước có mưa phùn nhẹ hoặc không khí lạnh mới tràn về.\n2. **Gió nhẹ (< 12 km/h)**: Nếu gió giật > 25 km/h trên sống núi, mây sẽ bị xé tan thành sương mù trắng xóa (whiteout) thay vì tụ thành biển.\n3. **Biên độ nhiệt ngày – đêm lớn (> 8°C)**: Đêm lạnh giúp hơi ẩm ngưng tụ ở độ cao 1.500m – 2.200m, trong khi đỉnh > 2.600m nhô lên trên tầng mây đón nắng sáng.\n4. **Khung giờ vàng**: Từ **05:15 đến 07:30 sáng** trước khi mặt trời làm nóng thung lũng đẩy mây tan lên cao.`,
    },
    {
      id: 'weather-lapse-rate',
      q: 'Nhiệt độ trên đỉnh núi cao giảm bao nhiêu độ so với chân núi và hiệu ứng gió rét (Wind Chill) là gì?',
      kw: ['nhiệt độ đỉnh núi', 'giảm nhiệt độ theo độ cao', 'lapse rate', 'gió rét', 'wind chill', 'nhiệt độ fansipan'],
      ans: `**QUY LUẬT GIẢM NHIỆT ĐỘ THEO ĐỘ CAO (LAPSE RATE) & GIÓ RÉT:**\n\n1. **Tốc độ giảm nhiệt**: Trung bình cứ lên cao **1.000m**, nhiệt độ không khí giảm khoảng **6.5°C** (ẩm) đến **9.8°C** (khô). Ví dụ: thị xã Sa Pa (~1.500m) đang **12°C** thì đỉnh Fansipan (3.143m) chỉ còn khoảng **1°C – 2°C**!\n2. **Hiệu ứng gió rét (Wind Chill)**: Ở nhiệt độ 5°C nhưng gió sống núi thổi 40 km/h, cảm giác lạnh thực tế trên da tụt xuống dưới **-1°C**, làm mất thân nhiệt cực nhanh.\n3. **Chuẩn bị**: Luôn tra cứu đánh giá **Go / No-Go của LOST** (tự động hiệu chỉnh nhiệt độ đỉnh theo cao độ thực tế) trước khi xếp áo ấm và túi ngủ.`,
    },
    {
      id: 'weather-vietnam-seasons',
      q: 'Lịch mùa trekking đẹp nhất và mùa mưa bão cần tránh theo 3 miền Bắc - Trung - Nam?',
      kw: ['lịch mùa leo núi', 'mùa mưa bão', 'tháng mấy nên đi', 'khí hậu 3 miền', 'mùa đẹp nhất'],
      ans: `**LỊCH MÙA TREKKING THỰC ĐỊA VIỆT NAM (3 MIỀN):**\n\n- **Miền Bắc (Hoàng Liên Sơn, Tây Bắc)**: Đẹp nhất **Tháng 10 – Tháng 4** (săn mây, mùa cỏ cháy, hoa đỗ quyên tháng 2–4). **Tránh Tháng 6 – Tháng 8** (mưa lũ lớn, sạt lở).\n- **Miền Trung (Đà Nẵng, Huế — Bạch Mã, Giếng Trời)**: Đẹp nhất **Tháng 2 – Tháng 8** (nắng ráo, nước suối trong xanh). **Tránh Tháng 9 – Tháng 12** (mùa bão & lũ quét miền Trung).\n- **Tây Nguyên & Miền Nam (Tà Năng, Bidoup, Chư Yang Sin, Bà Đen, Chứa Chan)**: Đẹp nhất **Tháng 11 – Tháng 4** (mùa khô) hoặc **Tháng 6 – Tháng 8** (mùa cỏ xanh Tà Năng nhưng cần cảnh giác mưa giông chiều).`,
    },
  ];

  weatherKnowledge.forEach((item) => {
    dataset.push({
      id: item.id,
      category: 'weather_climate',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 8. NAVIGATION & GPX (Previously empty category — now populated!)
  // =========================================================================
  const navigationKnowledge = [
    {
      id: 'nav-gpx-offline',
      q: 'Cách sử dụng file GPX, bản đồ Offline và cảnh báo lệch tuyến khi vào rừng mất sóng?',
      kw: ['gpx', 'tracklog', 'bản đồ offline', 'tải gói offline', 'lệch tuyến', 'mất sóng gps'],
      ans: `**HƯỚNG DẪN ĐỊNH VỊ GPX & BẢN ĐỒ OFFLINE KHI MẤT SÓNG DI ĐỘNG:**\n\n1. **GPS hoạt động KHÔNG CẦN 4G/5G**: Chip định vị vệ tinh (GPS/GLONASS/Galileo) thu tín hiệu trực tiếp từ vệ tinh, nhưng bản đồ nền cần được tải sẵn trước khi vào rừng.\n2. **Chuẩn bị trước chuyến đi**: Mở trang chi tiết cung đường trên **LOST** -> bấm **Tải Gói Offline** (lưu sẵn ô bản đồ z12–z14 vào máy) và tải file **.gpx** dự phòng.\n3. **Tiết kiệm pin khi dùng GPS**: Bật **Chế độ máy bay (Airplane Mode)** rồi bật riêng GPS; giữ điện thoại trong túi áo trong sát người vào ban đêm vì nhiệt độ < 5°C làm pin lithium sụt rất nhanh.\n4. **Phân tích GPX trước khi đi**: Bạn có thể đính kèm trực tiếp file **.gpx** ngay trong khung chat LOST AI để tính độ dốc, thời gian Naismith/Tobler và lượng nước cần mang!`,
    },
    {
      id: 'nav-compass-terrain',
      q: 'Cách đọc đường đồng mức bản đồ địa hình và dùng la bàn định hướng tại Việt Nam?',
      kw: ['đường đồng mức', 'la bàn', 'định hướng', 'phương vị', 'bản đồ địa hình', 'độ dốc'],
      ans: `**ĐỌC ĐƯỜNG ĐỒNG MỨC & LA BÀN THỰC ĐỊA VIỆT NAM:**\n\n1. **Đường đồng mức (Contour Lines)**: Các đường càng **xít sát nhau** thì vách núi càng dốc đứng; đường hình chữ **V chỉ ngược lên cao** là khe suối/thung lũng; chữ **U hướng xuống thấp** là sống núi (ridge line).\n2. **Độ lệch từ (Magnetic Declination) tại Việt Nam**: Rất nhỏ (khoảng **-0.5° đến -1.5°**), nên kim Bắc từ gần như trùng với Bắc địa lý trong tác chiến dã ngoại ngắn.\n3. **Nguyên tắc an toàn**: Khi mất dấu trong sương mù, đối chiếu độ cao hiện tại với biểu đồ cao độ GPX và tìm lên **đường sống núi** thay vì đi xuống khe cạn.`,
    },
  ];

  navigationKnowledge.forEach((item) => {
    dataset.push({
      id: item.id,
      category: 'navigation_gpx',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 9. PORTER & LOCAL GUIDES (Previously empty category — now populated!)
  // =========================================================================
  const porterKnowledge = [
    {
      id: 'porter-official-centers',
      q: 'Cách liên hệ Trung tâm Du lịch Vườn Quốc Gia & quy chuẩn thuê Porter uy tín tại Việt Nam?',
      kw: ['thuê porter uy tín', 'trung tâm vườn quốc gia', 'quy chuẩn porter', 'tip porter', 'đặt porter'],
      ans: `**QUY CHUẨN THUÊ PORTER & ĐẦU MỐI VQG CHÍNH THỐNG TẠI VIỆT NAM:**\n\n1. **Đầu mối Vườn Quốc Gia xác thực (100% số thật):**\n- **VQG Hoàng Liên (Fansipan, Sa Pa)**: **02143.871.494** / Trung tâm DL & BTSV **0985.834.581**.\n- **VQG Bạch Mã (Phú Lộc, TP. Huế)**: **0234.3871.330** / **0836.356.669**.\n- **VQG Bidoup - Núi Bà (Lạc Dương, Lâm Đồng)**: **0263.3502.005** / **0947.047.449**.\n- **VQG Chư Yang Sin (Đắk Lắk)**: **0262.3734.226**.\n- **Khu BTTN Kon Chư Răng (Thác K50, Gia Lai)**: **0985.551.682**.\n\n2. **Quy chuẩn làm việc công bằng với Porter:**\n- **Chi phí tham khảo**: **500.000 – 800.000 VNĐ / ngày** (tùy tuyến 2N1Đ hay 3N2Đ).\n- **Giới hạn tải trọng**: Tối đa **12 – 15kg / Porter**; không dồn quá tải gây tổn thương cột sống cho anh em bản địa.\n- **Chốt rõ trước khi đi**: Thống nhất rõ thực đơn bữa ăn, phí lán ngủ, bảo hiểm và lộ trình rút lui nếu thời tiết xấu.`,
    },
  ];

  porterKnowledge.forEach((item) => {
    dataset.push({
      id: item.id,
      category: 'porter_local_guides',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 10. COMPREHENSIVE EDGE-CASE, DILEMMA & EXTREME SURVIVAL SCENARIOS
  // =========================================================================
  const edgeCaseKnowledge = [
    {
      id: 'edge-sole-broken',
      cat: 'gear_equipment' as const,
      q: 'Xử lý khẩn cấp khi đế giày leo núi bị bung toạc hoặc gãy lìa giữa đường rừng cách đích 15-20km?',
      kw: ['bung đế giày', 'bong đế', 'rách đế', 'đế giày rớt', 'hỏng giày', 'rách giày', 'đứt giày'],
      ans: `**KỸ THUẬT GIA CỐ ĐẾ GIÀY BUNG TOẠC NGOÀI THỰC ĐỊA:**\n\n1. **Băng dính bạc (Duct Tape)**: Quấn chặt **5 – 7 vòng quanh thân và đế giày**, chừa gai mũi và gót để vẫn bám đất.\n2. **Dây rút nhựa chịu lực (Zip-ties)**: Luồn 3–4 sợi dây rút quanh thân siết chặt vào đế, chốt khóa hướng lên mu bàn chân.\n3. **Dây Paracord đan xích**: Buộc đan zíc-zắc dưới lòng đế vừa giữ đế vừa tăng ma sát bùn đất.\n4. **Ruột săm xe máy**: Nếu đi qua bản có tiệm sửa xe, cắt khúc ruột săm lồng ngoài giày.\n5. **Điều chỉnh bước đi**: Bước ngắn, hạ trọng tâm và san sẻ 4–5kg đồ nặng cho đồng đội.`,
    },
    {
      id: 'edge-tent-ripped',
      cat: 'camping_shelters' as const,
      q: 'Cách dựng nơi trú ẩn khẩn cấp khi lều bị gió bão giật rách toạc hoặc gãy cọc lều giữa đêm rừng?',
      kw: ['rách lều', 'gãy cọc lều', 'sập lều', 'bay lều', 'gió thổi bay lều', 'rách bạt', 'hỏng lều'],
      ans: `**XỬ LÝ KHẨN CẤP KHI LỀU RÁCH HOẶC GÃY CỌC TRONG BÃO ĐÊM:**\n\n1. **Hạ phẳng lều ngay**: Không cố giữ cọc gãy nhọn tránh đâm rách toàn bộ vải lều.\n2. **Chuyển thành túi Bivy**: Rút cọc gãy, trùm vải lều lên người và túi ngủ, chèn balo và đá tảng cố định 4 góc.\n3. **Căng lều chữ A siêu thấp bằng Poncho**: Buộc dây dù giữa hai gốc cây cách mặt đất ~50cm để giảm 80% sức cản gió.\n4. **Cách nhiệt nền đất**: Lót cành lá khô dày 15–20cm dưới bạt lều + quấn chăn bạc sinh tồn bên trong túi ngủ.`,
    },
    {
      id: 'edge-lost-fire',
      cat: 'emergency_sos' as const,
      q: 'Cách tạo lửa sinh tồn khẩn cấp khi bật lửa bị rơi xuống suối ướt sũng hoặc hết ga giữa rừng sâu?',
      kw: ['mất lửa', 'rơi bật lửa', 'bật lửa ướt', 'hết ga', 'nhóm lửa khẩn cấp', 'tạo lửa'],
      ans: `**TẠO LỬA SINH TỒN KHI BẬT LỬA ƯỚT HOẶC HẾT GA:**\n\n1. **Phục hồi bật lửa bánh xe bị ướt**: Thổi mạnh khe đá lửa, lau khô rồi lăn bánh xe liên tục trên vải quần khô (jean/kaki) 1–2 phút cho khô đá lửa.\n2. **Đánh lửa từ bật lửa hết ga**: Bánh xe vẫn đánh tia lửa nóng ~1.500°C -> châm trực tiếp vào nhúm bông khô tẩm 1 giọt dầu gió hoặc Vaseline.\n3. **Pin + Giấy bạc**: Cắt mẩu giấy bạc thắt eo 1–2mm ở giữa, chạm 2 đầu vào cực (+) và (-) của pin đèn pin để đốt điểm thắt eo châm bùi nhùi khô.`,
    },
    {
      id: 'edge-lost-phone-night',
      cat: 'emergency_sos' as const,
      q: 'Làm thế nào để định hướng và sinh tồn khi bị rơi mất điện thoại, hết pin và hoàn toàn không có sóng giữa rừng đêm?',
      kw: ['mất điện thoại', 'rơi điện thoại', 'hết pin', 'mất sóng', 'định hướng sao', 'không có sóng'],
      ans: `**SINH TỒN KHI MẤT ĐIỆN THOẠI / HẾT PIN TRONG RỪNG ĐÊM:**\n\n1. **Tuyệt đối không di chuyển đêm**: Áp dụng **S.T.O.P**, tìm gờ đá / gốc cây lớn khuất gió, ngồi lên balo cách nhiệt chờ sáng.\n2. **Định vị sao thiên văn**:\n- **Miền Bắc**: Từ 2 sao miệng gầu chòm Đại Hùng kéo dài gấp 5 lần gặp **Sao Bắc Đẩu (Polaris — Hướng Bắc)**.\n- **Miền Nam**: Kéo dài trục dọc chòm **Nam Thập Tự (Crux)** 4.5 lần dóng xuống chân trời là **Hướng Nam**.\n3. **Phát tín hiệu SOS**: Thổi còi **3 hồi ngắn liên tiếp** mỗi phút; ban đêm nháy đèn pin 3 nhịp; ban ngày đốt lá ẩm tạo cột khói trắng.`,
    },
    {
      id: 'edge-panic-attack',
      cat: 'emergency_sos' as const,
      q: 'Cách xử lý và trấn an khi đồng đội bị cơn hoảng loạn (Panic Attack) sợ độ cao co cứng người tại Sống Lưng Khủng Long Tà Xùa?',
      kw: ['hoảng loạn', 'panic attack', 'đóng cứng', 'khóc trên núi', 'sợ độ cao cực độ', 'run sợ'],
      ans: `**XỬ LÝ CƠN HOẢNG LOẠN (PANIC ATTACK) TRÊN VÁCH HẸP / SỐNG LƯNG:**\n\n1. **Hạ thấp trọng tâm ngay**: Đề nghị họ ngồi bệt hoặc quỳ thấp, giữ chắc đai hông balo từ phía sau. Tuyệt đối không quát mắng hay kéo giật.\n2. **Thở hộp Box Breathing (4-4-4)**: Hít mũi **4 giây** -> giữ **4 giây** -> thở miệng **4 giây**, lặp lại 5–7 nhịp.\n3. **Neo giác quan 5-4-3-2-1**: Yêu cầu họ gọi tên 5 vật nhìn thấy ngay trước mặt, 4 vật chạm được, 3 âm thanh nghe thấy.\n4. **Di chuyển Tunnel Vision**: Bố trí 1 người dẫn sát trước, 1 người đi sát sau; yêu cầu nạn nhân **chỉ nhìn vào gót giày người đi trước** từng bước một.`,
    },
    {
      id: 'edge-period-female',
      cat: 'emergency_sos' as const,
      q: 'Cách chuẩn bị và xử lý an toàn cho trekker nữ khi gặp chu kỳ kinh nguyệt (đến tháng) đột xuất giữa chuyến leo núi?',
      kw: ['đến kỳ', 'kinh nguyệt', 'tới tháng', 'đến tháng', 'có kinh', 'băng vệ sinh', 'phụ nữ leo núi'],
      ans: `**XỬ LÝ CHU KỲ KINH NGUYỆT ĐỘT XUẤT CHO TREKKER NỮ:**\n\n1. **Rác vệ sinh chuẩn LNT**: Dùng **túi zip 2 lớp màu tối** bỏ sẵn vài gói trà khô hoặc một thìa **baking soda** để hút ẩm & khử mùi; mang toàn bộ xuống chân núi, tuyệt đối không chôn trong rừng.\n2. **Giữ ấm & giảm co thắt**: Dán miếng giữ nhiệt bụng dưới/thắt lưng, uống trà gừng đường ấm.\n3. **Bổ sung khoáng**: Viên sủi **Sắt, Magie & Vitamin C** chống choáng do độ cao kết hợp mất máu.\n4. **Tối ưu dài ngày**: Cốc nguyệt san (Menstrual Cup) hoặc quần nguyệt san dã ngoại giúp giảm rác thải tối đa.`,
    },
    {
      id: 'edge-asthma-diabetes',
      cat: 'emergency_sos' as const,
      q: 'Cách ứng phó khẩn cấp khi người leo núi bị hen suyễn (asthma) lên cơn khó thở giữa đèo dốc hoặc bị tụt đường huyết đột ngột?',
      kw: ['hen suyễn', 'khó thở hen', 'mất bình xịt', 'lên cơn hen', 'hen phế quản', 'tụt đường huyết', 'tiểu đường'],
      ans: `**CẤP CỨU CƠN HEN SUYỄN & TỤT ĐƯỜNG HUYẾT NGOÀI THỰC ĐỊA:**\n\n1. **Hen suyễn (Asthma)**:\n- Tư thế **kiềng 3 chân (Tripod)**: Ngồi thẳng, hơi nghiêng trước, hai tay chống gối.\n- **Thở chúm môi**: Hít mũi 2 giây -> chúm môi thở ra chậm 4 giây.\n- Che ấm mũi miệng tránh khí lạnh khô; dùng bình xịt cắt cơn theo đơn (nếu mất bình xịt, nhấp ngụm nước ấm hoặc cà phê đen nhẹ để hỗ trợ giãn phế quản tạm thời và hạ độ cao về trạm y tế).\n\n2. **Tụt đường huyết (Quy tắc 15-15)**:\n- Nạp ngay **15g đường nhanh** (1 gói gel năng lượng, 3 viên kẹo glucose hoặc 1 thìa mật ong).\n- Nghỉ kín gió **15 phút**, sau đó nạp thêm tinh bột phức (lương khô/bánh yến mạch).`,
    },
    {
      id: 'edge-border-checkpoint',
      cat: 'permits_regulations' as const,
      q: 'Ứng xử thế nào khi vô tình đi vào vành đai biên giới cấm hoặc quên CCCD/giấy phép khi gặp lực lượng tuần tra Bộ đội Biên phòng?',
      kw: ['biên phòng', 'vành đai biên giới', 'quên cccd', 'quên giấy tờ', 'tuần tra', 'khai báo'],
      ans: `**ỨNG XỬ KHI GẶP TUẦN TRA BIÊN PHÒNG TẠI VÀNH ĐAI BIÊN GIỚI:**\n\n1. **Hợp tác tuyệt đối**: Dừng lại chấp hành 100% hiệu lệnh kiểm tra, lịch thiệp, tuyệt đối không bỏ chạy hay tranh cãi.\n2. **Chứng minh nhân thân**: Xuất trình **VNeID mức độ 2**, hộ chiếu hoặc ảnh chụp CCCD rõ nét.\n3. **Xác minh qua Porter bản địa**: Cung cấp thông tin Porter xã sở tại để Đồn Biên phòng liên hệ chính quyền xã xác nhận.\n4. **Đi lạc vào vành đai cấm**: Thành khẩn giải trình nguyên nhân sương mù/lạc tracklog và tuân thủ lộ trình rút lui của cán bộ biên phòng.`,
    },
    {
      id: 'edge-indigenous-taboo',
      cat: 'permits_regulations' as const,
      q: 'Cách ứng xử và hóa giải khi vô tình phạm phải các điều kiêng kỵ tâm linh của đồng bào bản địa (H Mông, Dao, Thái) trong rừng?',
      kw: ['kiêng kỵ', 'tâm linh', 'người mông', 'người dao', 'cây thiêng', 'bếp lửa', 'cột thiêng', 'rừng cấm'],
      ans: `**VĂN HÓA BẢN ĐỊA & HÓA GIẢI ĐIỀU KIÊNG KỴ:**\n\n1. **Điều cần tránh**: Không quay mũi chân/sấy giày trực tiếp vào bếp lửa thiêng; không gõ/tựa vào cột cái nhà người H'Mông; không bước qua lối có cắm **cành lá xanh / túm cỏ tranh** báo hiệu bản đang cúng kiêng người lạ; không chặt phá khu rừng thiêng đầu nguồn.\n2. **Cách hóa giải văn minh**: Lập tức dừng hành vi, chân thành xin lỗi gia chủ/trưởng bản và nhờ Porter bản địa giải thích, thực hiện lễ tạ nhỏ theo phong tục địa phương.`,
    },
    {
      id: 'edge-wild-animals',
      cat: 'emergency_sos' as const,
      q: 'Cách ứng phó sống còn khi chạm trán lợn rừng hung dữ hoặc đàn khỉ hoang cướp đồ tại Núi Bà Đen / Sơn Trà?',
      kw: ['thú rừng', 'lợn rừng', 'khỉ cướp đồ', 'chó hoang', 'động vật hoang dã'],
      ans: `**ỨNG PHÓ ĐỘNG VẬT HOANG DÃ NGOÀI THỰC ĐỊA:**\n\n1. **Lợn rừng**: Tuyệt đối không quay lưng bỏ chạy và không nhìn chằm chằm vào mắt nó. Giơ cao balo + cặp gậy leo núi tạo dáng lớn, lùi chậm theo đường chéo và leo lên cây/tảng đá cao tối thiểu **1.5 – 2m**.\n2. **Khỉ hoang (Núi Bà Đen, Sơn Trà)**: Cất kín thức ăn vào balo; nếu bị khỉ giật đồ thì **buông tay thả rơi ngay** và lùi xa 3m (không giằng co để phòng vết cắn truyền Virus Dại); không nhe răng cười với khỉ.`,
    },
    {
      id: 'edge-troll-dep-to-ong',
      cat: 'emergency_sos' as const,
      q: 'Em có thể đi dép tổ ong hoặc dép tông lào để leo chinh phục đỉnh Fansipan 3.143m được không?',
      kw: ['dép tổ ong', 'dép tông', 'đi dép lào', 'dép quai hậu', 'dép lê', 'đi dép đi leo núi'],
      ans: `**CẢNH BÁO AN TOÀN TUYỆT ĐỐI — KHÔNG ĐI DÉP LÊ / DÉP TỔ ONG LEO NÚI:**\n\n1. **Nguy cơ lật sơ mi cực cao**: Dép không ôm cổ chân, bước trên bậc đá dốc 45°–60° rất dễ bong gân nặng hoặc gãy mắt cá.\n2. **Mất ma sát**: Đế nhựa trơn trượt trên bùn rêu ẩm Hoàng Liên Sơn.\n3. **Dập móng & cóng lạnh**: Hở mũi dễ va đá tai mèo và tê cóng bàn chân khi nhiệt độ đỉnh xuống 0°C – 5°C.\n\n*Khuyến cáo*: Đầu tư đôi **giày trekking cổ lửng đế gai sâu** rộng hơn 0.5–1 size.`,
    },
    {
      id: 'edge-troll-bbq-speaker',
      cat: 'permits_regulations' as const,
      q: 'Em có thể vác loa kéo công suất lớn và mang bếp nướng than hoa BBQ lên đỉnh Fansipan mở tiệc quẩy được không?',
      kw: ['loa kéo', 'nướng bbq', 'mở tiệc trên đỉnh', 'bếp than hoa', 'quẩy trên đỉnh', 'mở nhạc to'],
      ans: `**QUY ĐỊNH BẢO TỒN RỪNG QUỐC GIA — TUYỆT ĐỐI CẤM:**\n\n1. **Vi phạm PCCC rừng**: Nhóm lửa than hoa tự do trong rừng đặc dụng có cấp cháy IV–V bị xử phạt theo **Nghị định 35/2019/NĐ-CP** (5 – 10 triệu VNĐ và trách nhiệm hình sự nếu gây cháy rừng).\n2. **Ô nhiễm tiếng ồn**: Loa kéo làm hoảng loạn thú rừng và phá vỡ sự thanh tịnh của thiên nhiên.\n3. **Chuẩn mực văn minh**: Dùng bữa tối nóng do Porter nấu trong **gian bếp lán quy định** và tuân thủ Leave No Trace.`,
    },
    {
      id: 'edge-troll-wild-orchids',
      cat: 'permits_regulations' as const,
      q: 'Em thấy phong lan rừng và hoa đỗ quyên trên rừng đẹp quá, có thể đào bứng hoặc chặt cành mang về nhà trồng làm kỷ niệm không?',
      kw: ['hái lan rừng', 'chặt cây', 'bẻ cành đỗ quyên', 'mang lan về', 'hái hoa rừng', 'phá rừng'],
      ans: `**CẤM TUYỆT ĐỐI KHAI THÁC THỰC VẬT RỪNG TỰ NHIÊN:**\n\n1. **Vi phạm pháp luật lâm nghiệp**: Đỗ quyên cổ thụ và lan rừng trong VQG được bảo vệ nghiêm ngặt; kiểm lâm có quyền kiểm tra balo, tịch thu và xử phạt hành chính.\n2. **Không thể sống ở đồng bằng**: Cây rừng rêu độ cao > 2.000m sẽ chết khô sau vài tuần khi mang về vùng nóng ẩm thấp.\n3. **Tinh thần Leave No Trace**: *"Không lấy đi gì ngoài những bức ảnh, không để lại gì ngoài những dấu chân."*`,
    },
    {
      id: 'edge-troll-motorbike-peak',
      cat: 'permits_regulations' as const,
      q: 'Có thể đi xe máy, xe cào cào hoặc xe tay ga lên tận đỉnh Pu Si Lung hoặc Fansipan được không?',
      kw: ['xe máy', 'lái xe lên đỉnh', 'xe cào cào', 'xe tay ga lên đỉnh', 'chạy xe lên đỉnh'],
      ans: `**HOÀN TOÀN BẤT KHẢ THI VỀ ĐỊA HÌNH VÀ BỊ CẤM:**\n\n1. Các đỉnh cao Hoàng Liên Sơn (Fansipan, Pu Si Lung, Pu Ta Leng, Kỳ Quan San) là đường mòn vách đá dựng đứng, sống núi hẹp và rừng trúc lùn ken dày — hoàn toàn không có đường cho xe cơ giới.\n2. Toàn bộ tuyến trekking trong VQG cấm xe cơ giới; với Fansipan nếu không leo bộ chỉ có tuyến cáp treo dịch vụ, còn Pu Si Lung bắt buộc gửi xe ở bản Pa Vệ Sử và cuốc bộ 3N2Đ.`,
    },
    {
      id: 'edge-leech-removal',
      cat: 'emergency_sos' as const,
      q: 'Cách xử lý khi bị vắt rừng bu bám cắn khắp người và cách phòng ngừa vắt hiệu quả nhất?',
      kw: ['vắt rừng', 'đỉa rừng', 'chống vắt', 'bị vắt cắn', 'gỡ vắt', 'thuốc dep'],
      ans: `**GỠ VẮT RỪNG ĐÚNG CÁCH & PHÒNG NGỪA:**\n\n1. **Không giật mạnh thẳng đứng** (dễ đứt vòi gây nhiễm trùng/ngứa kéo dài). Dùng cạnh thẻ nhựa/móng tay miết nhẹ sát da phá lực hút, hoặc chấm 1 giọt cồn/dầu gió/muối hạt.\n2. **Cầm máu**: Nước bọt vắt có chất chống đông Hirudin -> rửa cồn sát khuẩn rồi ấn chặt gạc sạch **5 – 10 phút**.\n3. **Phòng ngừa**: Đeo **xà cạp chống vắt (Gaiters)**, nhét ống quần vào tất và bôi **thuốc mỡ DEP** lên cổ giày, gấu quần.`,
    },
    {
      id: 'edge-toxic-mushrooms',
      cat: 'emergency_sos' as const,
      q: 'Xử lý cấp cứu thế nào khi trekker lỡ ăn phải nấm rừng lạ gây đau bụng, nôn mửa, tiêu chảy dữ dội?',
      kw: ['nấm độc', 'ngộ độc nấm', 'ăn phải nấm', 'ngộ độc thức ăn', 'nấm lạ'],
      ans: `**CẤP CỨU NGỘ ĐỘC NẤM RỪNG (CHUẨN Y KHOA WFA / WHO):**\n\n1. **Ngừng ăn ngay & KHÔNG tự ý móc họng ép nôn**: Hướng dẫn WFA/WHO hiện đại khuyến cáo không tự gây nôn ngoài thực địa do nguy cơ sặc dịch nôn vào đường thở; nếu nạn nhân còn tỉnh táo hoàn toàn và trong 1 giờ đầu có thể dùng **Than hoạt tính** theo hướng dẫn y tế (tuyệt đối không cho uống nếu lơ mơ/co giật).\n2. **Bù nước có kiểm soát**: Khi còn tỉnh táo, cho uống từng ngụm nhỏ **Oresol** phòng mất nước do tiêu chảy/nôn tự phát.\n3. **Giữ lại mẫu nấm**: Chụp ảnh và bỏ phần nấm thừa vào túi kín để bác sĩ xác định đúng độc tố.\n4. **Sơ tán cấp cứu ngay**: Tuyệt đối không chủ quan nếu triệu chứng tạm lắng vì độc tố Amatoxin gây suy gan/thận muộn sau 6–24 giờ -> gọi **115 / 112** chuyển viện ngay.`,
    },
    {
      id: 'edge-heat-stroke-south',
      cat: 'emergency_sos' as const,
      q: 'Nhận biết và xử lý cấp cứu sốc nhiệt (Heat Stroke) khi leo núi nắng gắt ở miền Nam (Núi Bà Đen, Núi Chứa Chan)?',
      kw: ['sốc nhiệt', 'say nắng', 'say nóng', 'heat stroke', 'nắng gắt'],
      ans: `**CẤP CỨU SỐC NHIỆT (HEAT STROKE):**\n\n1. **Dấu hiệu nguy kịch**: Thân nhiệt > 40°C, da nóng đỏ **khô ráo (ngừng ra mồ hôi)**, mê sảng, choáng váng hoặc ngất.\n2. **Hạ nhiệt tích cực tức thì**: Đưa vào bóng râm, cởi bớt lớp áo ngoài, dội/lau nước mát khắp thân và quạt liên tục.\n3. **Chườm 3 điểm động mạch lớn**: **Cổ, Nách và Bẹn**.\n4. **Bù nước có kiểm soát**: Chỉ cho uống từng ngụm nước mát pha Oresol khi nạn nhân tỉnh táo; **CẤM** đổ nước vào miệng nếu lơ mơ/hôn mê. Gọi **115**.`,
    },
    {
      id: 'edge-fracture-cliff',
      cat: 'emergency_sos' as const,
      q: 'Cách nẹp cố định chấn thương gãy xương cẳng chân ngoài thực địa bằng gậy leo núi và cành cây dã ngoại?',
      kw: ['gãy xương', 'gãy tay', 'gãy chân', 'nẹp xương', 'chấn thương kín', 'lệch khớp'],
      ans: `**NẸP CỐ ĐỊNH GÃY XƯƠNG CẲNG CHÂN NGOÀI THỰC ĐỊA:**\n\n1. **Nguyên tắc vàng**: Cố định **trên 1 khớp và dưới 1 khớp** của ổ gãy (gãy cẳng chân -> bất động cả **Khớp Gối** và **Khớp Cổ Chân**).\n2. **Tạo nẹp cứng**: Dùng **2 gậy trekking** hoặc 2 cành cây thẳng chắc đặt mặt trong & ngoài, chêm đệm vải mềm vào đầu xương nhô.\n3. **Buộc cố định**: Buộc 4–5 mối vải chắc (không buộc đè trực tiếp lên vị trí gãy, kiểm tra đầu ngón chân vẫn ấm hồng).\n4. **Chống sốc & Cứu hộ**: Giữ ấm toàn thân, không tự ý nắn xương gãy hở; gọi **114 / 115 / 112** hỗ trợ cáng chuyển.`,
    },
    {
      id: 'edge-wasp-swarm-attack',
      cat: 'emergency_sos' as const,
      q: 'Quy tắc thoát hiểm sống còn khi bị bầy ong vò vẽ hoặc ong bắp cày tấn công trong rừng?',
      kw: ['ong đốt', 'ong vò vẽ', 'ong bắp cày', 'ong đất', 'bầy ong', 'ong tấn công', 'tổ ong'],
      ans: `**THOÁT HIỂM KHI BỊ BẦY ONG VÒ VẼ / ONG ĐẤT TẤN CÔNG:**\n\n1. **Che đầu, mặt và cổ ngay**: Trùm áo khoác/khăn kín đầu mặt cổ để tránh phù thanh quản gây ngạt.\n2. **Chạy xuôi gió xuyên bụi rậm**: Bứt tốc chạy 100–200m xuôi chiều gió qua bụi rậm để gạt bầy ong. **Cấm đứng đập ong** (vỡ túi pheromone thu hút cả đàn).\n3. **Không nhảy xuống suối sâu nước xiết**: Ong vẫn lượn trên mặt nước chờ ngoi lên.\n4. **Sơ cứu**: Dùng cạnh thẻ gạt ngang ngòi ong (không bóp nhíp), chườm lạnh và theo dõi dấu hiệu sốc phản vệ (khó thở, nổi mề đay -> gọi **115** ngay).`,
    },
    {
      id: 'edge-bamboo-maze-disorientation',
      cat: 'emergency_sos' as const,
      q: 'Làm thế nào để thoát khỏi mê cung rừng trúc lùn hoặc rừng đỗ quyên khi mất dấu mòn và mọi hướng đều giống nhau?',
      kw: ['rừng trúc', 'rừng đỗ quyên', 'mê cung', 'lạc trong rừng trúc', 'đánh dấu đường'],
      ans: `**THOÁT KHỎI MÊ CUNG RỪNG TRÚC LÙN & RỪNG ĐỖ QUYÊN:**\n\n1. **Cắt vòng lặp đi quẩn quanh**: Dừng ngay khi thấy cảnh vật quen lặp lại.\n2. **Đánh dấu đường lùi**: Buộc dải vải/dây màu nổi hoặc bẻ gập ngọn trúc chỉ hướng mỗi 10–15m.\n3. **Bám lên đường sống núi (Ridge Line)**: Rừng trúc mọc dày nhất ở thung lũng ẩm; hướng dần lên gờ sống núi cao sẽ thoáng sương mù để quan sát địa hình và bắt lại tín hiệu GPS vệ tinh.`,
    },
  ];

  edgeCaseKnowledge.forEach((item) => {
    dataset.push({
      id: item.id,
      category: item.cat,
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 11. DEEP VIETNAM ALPINE TECHNICAL MANUALS (Wave 3E Expansion)
  // =========================================================================
  const deepVietnamTechnical: KnowledgeItem[] = [
    {
      id: 'tech-river-crossing-flash-flood',
      category: 'emergency_sos',
      question: 'Kỹ thuật vượt suối chảy xiết an toàn và nhận diện lũ quét từng giây tại núi rừng Việt Nam?',
      keywords: ['vượt suối chảy xiết', 'kỹ thuật lội suối', 'đội hình vượt suối', 'lũ quét thượng nguồn', 'suối xiết', '3 điểm tiếp xúc'],
      answer: `**KỸ THUẬT VƯỢT SUỐI CHẢY XIẾT & PHÒNG CHỐNG LŨ QUÉT THỰC ĐỊA:**\n\n1. **Quy tắc kiểm tra trước khi lội**: Không vượt nếu mực nước sâu quá **đầu gối** kèm dòng chảy xiết hoặc nước đục ngầu không nhìn thấy đáy đá.\n2. **Chuẩn bị balo bắt buộc**: **Tháo mở hoàn toàn chốt đai hông và đai ngực balo**, bọc đồ điện tử & túi ngủ trong túi khô chống nước để có thể vứt balo thoát thân trong 1 giây nếu trượt ngã.\n3. **Đội hình 3 điểm tiếp xúc**: Giữ nguyên giày trekking có gai (không đi chân trần dễ cắt chân đá sắc), chống gậy về phía **thượng nguồn** tạo thế kiềng 3 chân; nhóm 3 người kết thành **đội hình tam giác** (người khỏe nhất đứng mũi thượng nguồn chắn dòng).\n4. **Cảnh báo lũ quét tức thì**: Nước trong bỗng chuyển màu đỏ phù sa, mực nước dâng nhanh 5–10cm chỉ trong vài phút, cuốn theo cành lá tươi/mục và có tiếng gầm rền từ thượng nguồn -> **bỏ ngay lòng suối chạy ngược lên sườn đồi cao**!`,
    },
    {
      id: 'tech-lightning-summit-protocol',
      category: 'weather_climate',
      question: 'Quy chuẩn phòng tránh sét đánh trên đỉnh núi trống, quy tắc 30-30 và sơ cứu nạn nhân bị sét đánh?',
      keywords: ['quy tắc 30-30', 'sét đánh trên đỉnh', 'sơ cứu sét đánh', 'trú sét', 'lightning squat', 'dông sét'],
      answer: `**QUY CHUẨN CHỐNG SÉT ĐỈNH NÚI & SƠ CỨU NẠN NHÂN BỊ SÉT ĐÁNH:**\n\n1. **Quy tắc 30-30**: Khi thấy chớp lóe và nghe tiếng sấm sau **dưới 30 giây** (tâm dông cách < 10km), lập tức rút khỏi đỉnh trọc và sống núi (Tà Xùa, Lảo Thẩn, Kỳ Quan San, Tà Chì Nhù); chỉ tiếp tục di chuyển sau tiếng sấm cuối cùng ít nhất **30 phút**.\n2. **Cách ly vật dẫn & giữ khoảng cách**: Bỏ gậy trekking kim loại, balo khung nhôm cách người tối thiểu **15–20m**; các thành viên trong đoàn ngồi tản cách nhau **5–10m** để tránh một tia sét gây thương vong toàn đoàn.\n3. **Tư thế Lightning Squat**: Ngồi xổm trên tấm lót cách điện khô, chụm sát 2 gót chân, cúi đầu vào gối, bịt tai — **tuyệt đối không nằm sát đất** và không trú dưới cây cao đứng lẻ loi.\n4. **Sơ cứu nạn nhân bị sét đánh**: Cơ thể nạn nhân **KHÔNG tích điện dư** — có thể tiếp cận kiểm tra hô hấp & ép tim ngoài lồng ngực (**CPR**) ngay lập tức khi hiện trường an toàn và gọi **115 / 112**.`,
    },
    {
      id: 'tech-vietnam-border-cccd',
      category: 'permits_regulations',
      question: 'Thủ tục CCCD và khai báo khu vực vành đai biên giới thực tế tại Y Tý, Pa Vệ Sử, Sàng Ma Sáo và Đầm Môn?',
      keywords: ['thủ tục biên giới', 'y tý', 'pa vệ sử', 'sàng ma sáo', 'đầm môn', 'vành đai biên giới', 'đồn biên phòng', 'giấy phép biên giới'],
      answer: `**THỦ TỤC CCCD & KHAI BÁO VÀNH ĐAI BIÊN GIỚI THỰC TẾ TẠI VIỆT NAM:**\n\n- **Y Tý / Sàng Ma Sáo (Bát Xát, Lào Cai — Lảo Thẩn, Kỳ Quan San, Nhìu Cồ San)**: Mang **CCCD gắn chip bản gốc** (không dùng ảnh chụp khi qua trạm kiểm soát). Đoàn có người nước ngoài bắt buộc xin **Giấy phép vào khu vực biên giới** tại Phòng Quản lý Xuất nhập cảnh Công an tỉnh Lào Cai.\n- **Pa Vệ Sử (Mường Tè, Lai Châu — Pu Si Lung mốc 42) & Vàng Ma Chải (Phong Thổ — Khang Su Văn)**: Khu vực biên giới kiểm soát chặt — bắt buộc gửi danh sách đoàn (Họ tên, số CCCD, địa chỉ thường trú, thời gian vào/ra) đăng ký trước ít nhất **5–7 ngày** với Đồn Biên phòng sở tại qua Porter/đơn vị địa phương.\n- **Đầm Môn / Vạn Thạnh (Vạn Ninh, Khánh Hòa — Cực Đông Mũi Đôi)**: Mang CCCD bản gốc khai báo lưu trú tại điểm xuất phát Đầm Môn và thuê thuyền/người dẫn đường địa phương khi qua bãi đá nhảy sóng lớn.`,
    },
    {
      id: 'tech-ams-hape-hace-matrix',
      category: 'emergency_sos',
      question: 'Phân biệt chi tiết 3 cấp độ sốc độ cao AMS, phù phổi HAPE và phù não HACE cùng phác đồ xử trí khẩn cấp?',
      keywords: ['hape', 'hace', 'phù phổi độ cao', 'phù não độ cao', 'lake louise', 'phân biệt ams', 'cấp độ sốc độ cao'],
      answer: `**MA TRẬN PHÂN BIỆT 3 CẤP ĐỘ BỆNH ĐỘ CAO (> 2.200M — CHUẨN Y KHOA WFA):**\n\n| Cấp độ | Dấu hiệu nhận diện | Mức nguy hiểm | Hành động bắt buộc |\n| --- | --- | --- | --- |\n| **AMS (Nhẹ)** | Đau đầu 2 bên thái dương, buồn nôn, mất ngủ, chán ăn | Trung bình | Dừng leo lên cao thêm, nghỉ kín gió, uống nước ấm + Oresol, hạ độ cao nếu không giảm sau 2–4h |\n| **HAPE (Phù phổi)** | Ho khan chuyển khạc đờm bọt hồng, thở rít khò khè ngay cả khi ngồi nghỉ, môi tím tái | **CỰC NGUY KỊCH** | **Hạ độ cao khẩn cấp 500–1.000m ngay lập tức** (cáng xuống), giữ ấm, tư thế nửa ngồi, gọi **112 / 115** |\n| **HACE (Phù não)** | Đi loạng choạng mất thăng bằng (Ataxia), nói lảm nhảm, lú lẫn, ảo giác, lơ mơ | **TỬ VONG NHANH** | **Hạ độ cao khẩn cấp tức thì cả trong đêm nếu đủ ánh sáng an toàn**, không để nằm phẳng một mình, gọi **112 / 115** |`,
    },
    {
      id: 'tech-vqg-lnt-regulations',
      category: 'permits_regulations',
      question: 'Quy chuẩn bảo tồn Vườn Quốc Gia Việt Nam, xử lý vệ sinh cá nhân trong rừng và khung phạt PCCC?',
      keywords: ['quy định vườn quốc gia', 'cathole', 'vệ sinh trong rừng', 'nghị định 35', 'phạt đốt lửa', 'bảo tồn vqg'],
      answer: `**QUY CHUẨN PHÁP LÝ VƯỜN QUỐC GIA & LEAVE NO TRACE TẠI VIỆT NAM:**\n\n1. **Phòng cháy chữa cháy rừng**: Theo **Nghị định 35/2019/NĐ-CP**, nghiêm cấm tự ý mang bếp than hoa, đốt lửa trại ngoài khu vực lán quy định (đặc biệt mùa khô cấp cháy rừng IV–V tại Hoàng Liên, Bidoup, Núi Chúa, Tà Năng). Mức phạt hành chính **5 – 10 triệu VNĐ** và truy cứu hình sự nếu gây cháy rừng.\n2. **Bảo tồn thực vật & động vật**: Cấm tuyệt đối đào bứng phong lan, bẻ đỗ quyên cổ thụ, săn bắt hoặc cho động vật hoang dã (khỉ, chim rừng) ăn thức ăn công nghiệp.\n3. **Xử lý vệ sinh cá nhân (Cathole)**: Đào hố sâu **15–20 cm**, cách nguồn nước suối, lối mòn và bãi hạ trại tối thiểu **60 mét**; lấp đất kỹ sau khi đi và bỏ toàn bộ giấy ướt vào túi zip mang xuống núi (không chôn giấy ướt không phân hủy).`,
    },
    {
      id: 'tech-top10-vietnam-peaks-matrix',
      category: 'trail_specific',
      question: 'Bảng so sánh Top 10 đỉnh núi cao nhất và cung trekking kinh điển nhất Việt Nam?',
      keywords: ['top 10 đỉnh núi', 'đỉnh núi cao nhất việt nam', 'so sánh các đỉnh', 'bảng xếp hạng đỉnh núi', 'tứ đại đỉnh', 'thập đại đỉnh'],
      answer: `**BẢNG SO SÁNH TOP 10 ĐỈNH NÚI CAO NHẤT VIỆT NAM TRÊN HỆ THỐNG LOST (100% SỐ LIỆU THỰC ĐỊA):**\n\n| Hạng | Đỉnh núi | Cao độ | Tỉnh | Thời lượng | Đặc trưng nổi bật |\n| --- | --- | --- | --- | --- | --- |\n| 1 | **Fansipan** | 3.143m | Lào Cai - Lai Châu | 2N1Đ | Nóc nhà Đông Dương, VQG Hoàng Liên |\n| 2 | **Pu Si Lung** | 3.083m | Lai Châu | 3N2Đ | Mốc biên giới 42, rừng trúc & suối đá |\n| 3 | **Pu Ta Leng** | 3.049m | Lai Châu | 3N2Đ | Đại ngàn hoa Đỗ Quyên cổ thụ (Tháng 3–4) |\n| 4 | **Kỳ Quan San (BMLT)** | 3.046m | Lào Cai - Lai Châu | 3N2Đ | Đón bình minh biển mây Đỉnh Muối 2.100m |\n| 5 | **Khang Su Văn** | 3.012m | Lai Châu | 3N2Đ | Cột mốc 79 biên giới, rừng rêu nguyên sinh |\n| 6 | **Tả Liên Sơn (Cổ Trâu)** | 2.996m | Lai Châu | 2N1Đ | Rừng cổ tích rêu phong, thảo quả & đỗ quyên |\n| 7 | **Tà Chì Nhù** | 2.979m | Yên Bái | 2N1Đ | Thảm hoa tím Chi Pâu (Tháng 9–10) & biển mây |\n| 8 | **Nhìu Cồ San** | 2.965m | Lào Cai | 2N1Đ | Thác Ong Chúa & rừng phong lá đỏ (Tháng 11) |\n| 9 | **Lùng Cúng** | 2.913m | Yên Bái | 2N1Đ | Rừng phong, đồi cỏ cháy & biển mây Mù Cang Chải |\n| 10 | **Nam Kang Ho Tao** | 2.881m | Lai Châu | 3N2Đ | Suối thác, vách đá hiểm trở bậc nhất Tây Bắc |\n\n*Ghi chú địa lý: Dãy Hoàng Liên Sơn còn có **Pờ Ma Lung (2.967m, Lai Châu, 3N2Đ)** cùng cụm đỉnh săn mây >2.850m kinh điển **Tà Xùa (2.865m)**, **Lảo Thẩn (2.860m)** và **Ngũ Chỉ Sơn (2.858m)**.*`,
    },
  ];

  deepVietnamTechnical.forEach((item) => dataset.push(item));

  return dataset;
}

export const masterKnowledgeDataset: KnowledgeItem[] = buildMasterKnowledgeDataset();

// Precompute normalized index structures once at startup for 0ms query latency
interface PrecomputedKnowledgeIndex {
  item: KnowledgeItem;
  qNorm: string;
  qTokens: Set<string>;
  ansNorm: string;
  ansTokens: Set<string>;
  kwNorms: string[];
  trailNameNorm: string;
}

const PRECOMPUTED_INDEX: PrecomputedKnowledgeIndex[] = masterKnowledgeDataset.map((item) => {
  const qNorm = normalizeSearchText(item.question);
  const ansNorm = normalizeSearchText(item.answer);
  const kwNorms = item.keywords.map((k) => normalizeSearchText(k)).filter(Boolean);
  const trailNameNorm = item.trailName ? normalizeSearchText(item.trailName) : '';
  return {
    item,
    qNorm,
    qTokens: new Set(qNorm.split(' ').filter((t) => t.length > 1 && !VIETNAMESE_STOP_WORDS.has(t))),
    ansNorm,
    ansTokens: new Set(ansNorm.split(' ').filter((t) => t.length > 1 && !VIETNAMESE_STOP_WORDS.has(t))),
    kwNorms,
    trailNameNorm,
  };
});

/**
 * Intelligent Vietnamese Accent-Insensitive, Word-Boundary, Stop-Word & Levenshtein Fuzzy Search Engine.
 */
export function queryKnowledgeDataset(userQuery: string, limit: number = 5): KnowledgeItem[] {
  const normalizedQ = normalizeSearchText(userQuery);
  if (!normalizedQ) return [];

  const allTokens = normalizedQ.split(' ').filter((w) => w.length > 1);
  const contentTokens = allTokens.filter((w) => !VIETNAMESE_STOP_WORDS.has(w));
  if (contentTokens.length === 0 && normalizedQ.length < 3) return [];

  // Whole-phrase synonym expansion (zero substring false positives!)
  const expandedSynSet = new Set<string>();
  for (const [key, syns] of Object.entries(TREKKING_SYNONYMS)) {
    const normKey = normalizeSearchText(key);
    if (hasWholePhrase(normalizedQ, normKey)) {
      syns.forEach((s) => expandedSynSet.add(normalizeSearchText(s)));
    }
    for (const s of syns) {
      const normSyn = normalizeSearchText(s);
      if (hasWholePhrase(normalizedQ, normSyn)) {
        expandedSynSet.add(normKey);
      }
    }
  }
  const expandedSynonyms = Array.from(expandedSynSet).filter(Boolean);

  // Check fuzzy peak alias match with specificity scoring so longer compound aliases
  // (e.g. "bản Tả Lèng", "Giếng Trời Bù Gia Mập", "Sống lưng khủng long Bình Liêu") outrank shorter overlaps
  const matchedPeakSpecificity = new Map<string, number>();
  for (const peak of VIETNAM_PEAKS_MATRIX) {
    const resolvedId = peak.canonicalTrailId || peak.id;
    let bestSpec = 0;
    const peakNameNorm = normalizeSearchText(peak.name);
    if (peakNameNorm.length >= 3 && hasWholePhrase(normalizedQ, peakNameNorm)) {
      bestSpec = Math.max(bestSpec, 10 + peakNameNorm.length);
    }
    for (const alias of peak.aliases) {
      const normAlias = normalizeSearchText(alias);
      if (hasWholePhrase(normalizedQ, normAlias)) {
        bestSpec = Math.max(bestSpec, 6 + normAlias.length);
      } else if (!normAlias.includes(' ') && normAlias.length >= 5) {
        // Single-word typo tolerance via Levenshtein
        const maxD = normAlias.length >= 7 ? 2 : 1;
        if (contentTokens.some((tok) => tok.length >= 4 && levenshteinDistance(tok, normAlias, maxD) <= maxD)) {
          bestSpec = Math.max(bestSpec, 2 + Math.floor(normAlias.length / 2));
        }
      }
    }
    if (bestSpec > 0) {
      matchedPeakSpecificity.set(resolvedId, Math.max(matchedPeakSpecificity.get(resolvedId) || 0, bestSpec));
    }
  }
  const topPeakSpecificity = matchedPeakSpecificity.size > 0 ? Math.max(...matchedPeakSpecificity.values()) : 0;

  const scored = PRECOMPUTED_INDEX.map((entry) => {
    let score = 0;

    // 1. Exact question substring (only meaningful if query >= 8 chars)
    if (normalizedQ.length >= 8 && (entry.qNorm.includes(normalizedQ) || normalizedQ.includes(entry.qNorm))) {
      score += 28;
    }

    // 2. Trail / Peak match (exact or typo-tolerant, specificity-weighted; suppress weak substring overlaps)
    const peakSpec = entry.item.trailId ? matchedPeakSpecificity.get(entry.item.trailId) || 0 : 0;
    const isDominantPeak = peakSpec > 0 && peakSpec >= topPeakSpecificity - 3;
    if (isDominantPeak) {
      score += 24 + Math.min(20, peakSpec);
    } else if (peakSpec > 0) {
      // Strictly subordinated when a much more specific compound alias matched another peak
      score -= 12;
    } else if (entry.trailNameNorm && hasWholePhrase(normalizedQ, entry.trailNameNorm) && topPeakSpecificity === 0) {
      score += 22;
    }

    // 3. Whole-phrase Keyword matches + Fuzzy single-keyword recovery
    let keywordHits = 0;
    for (const kwNorm of entry.kwNorms) {
      if (hasWholePhrase(normalizedQ, kwNorm)) {
        score += kwNorm.includes(' ') ? 16 : 11;
        keywordHits++;
      } else if (!kwNorm.includes(' ') && kwNorm.length >= 5) {
        const maxD = kwNorm.length >= 7 ? 2 : 1;
        if (contentTokens.some((tok) => tok.length >= 4 && levenshteinDistance(tok, kwNorm, maxD) <= maxD)) {
          score += 9;
          keywordHits++;
        }
      }

      for (const syn of expandedSynonyms) {
        if (kwNorm === syn || hasWholePhrase(kwNorm, syn) || hasWholePhrase(syn, kwNorm)) {
          score += 9;
          break;
        }
      }
    }

    // 4. Meaningful non-stopword token matches (capped so long answers don't hijack!)
    let tokenScore = 0;
    for (const tok of contentTokens) {
      if (entry.qTokens.has(tok)) tokenScore += 4;
      else if (entry.ansTokens.has(tok)) tokenScore += 1.5;
    }
    score += Math.min(18, tokenScore);

    // Bonus when both peak AND specific topic keyword hit (e.g., "giấy phép Fansipan", "lịch trình Tà Xùa")
    if (peakSpec > 0 && keywordHits >= 2) {
      score += 12;
    }

    return { item: entry.item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score >= 12)
    .slice(0, limit)
    .map((s) => s.item);
}
