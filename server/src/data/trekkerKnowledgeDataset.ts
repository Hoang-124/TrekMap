/**
 * MASTER TREKKER KNOWLEDGE DATASET
 * Comprehensive Vietnam Mountain Trekking, Wilderness Survival (WFA), Navigation & First-Aid Knowledge Base
 */

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

// TOP 25 FAMOUS PEAKS & TRAILS MATRIX IN VIETNAM (100% Real Geographical Data)
export const VIETNAM_PEAKS_MATRIX = [
  { id: 'fansipan', name: 'Fansipan', altitude: 3143, province: 'Lào Cai - Lai Châu', region: 'Miền Bắc', rescue: '02143.871.228', checkpoint: 'Trạm Tôn / Sín Chải', days: '2N1Đ' },
  { id: 'pusilung', name: 'Pusilung', altitude: 3083, province: 'Lai Châu', region: 'Miền Bắc', rescue: '02133.876.114', checkpoint: 'Đồn Biên phòng Pa Vệ Sử', days: '3N2Đ' },
  { id: 'putaleng', name: 'Putaleng', altitude: 3049, province: 'Lai Châu', region: 'Miền Bắc', rescue: '02133.876.114', checkpoint: 'Bản Tả Lèng / Hồ Thầu', days: '3N2Đ' },
  { id: 'ky_quan_san', name: 'Kỳ Quan San (Bạch Mộc Lương Tử)', altitude: 3046, province: 'Lào Cai - Lai Châu', region: 'Miền Bắc', rescue: '02143.883.114', checkpoint: 'Bản Sàng Ma Pho / Dền Sung', days: '3N2Đ' },
  { id: 'khang_su_van', name: 'Khang Su Văn', altitude: 3012, province: 'Lai Châu', region: 'Miền Bắc', rescue: '02133.876.114', checkpoint: 'Đồn Biên phòng Vàng Ma Chải', days: '2N1Đ' },
  { id: 'ta_chi_nhu', name: 'Tà Chì Nhù', altitude: 2979, province: 'Yên Bái', region: 'Miền Bắc', rescue: '02163.871.114', checkpoint: 'Mỏ chì Xà Hồ, Trạm Tấu', days: '2N1Đ' },
  { id: 'nhiu_co_san', name: 'Nhìu Cồ San', altitude: 2965, province: 'Lào Cai', region: 'Miền Bắc', rescue: '02143.883.114', checkpoint: 'Bản Nhìu Cồ San, Bát Xát', days: '2N1Đ' },
  { id: 'lung_cung', name: 'Lùng Cúng', altitude: 2913, province: 'Yên Bái', region: 'Miền Bắc', rescue: '02163.871.114', checkpoint: 'Bản Tu San / Lùng Cúng, Mù Cang Chải', days: '2N1Đ' },
  { id: 'nam_kang_ho_cora', name: 'Nam Kang Ho Cora', altitude: 2880, province: 'Lai Châu', region: 'Miền Bắc', rescue: '02133.876.114', checkpoint: 'Xã Tả Ngảo, Sìn Hồ', days: '2N1Đ' },
  { id: 'ta_xua', name: 'Tà Xùa', altitude: 2865, province: 'Sơn La - Yên Bái', region: 'Miền Bắc', rescue: '02123.852.114', checkpoint: 'Bản Bản Công, Trạm Tấu', days: '2N1Đ' },
  { id: 'lao_than', name: 'Lảo Thẩn', altitude: 2860, province: 'Lào Cai', region: 'Miền Bắc', rescue: '02143.888.114', checkpoint: 'Bản Phìn Hồ, Y Tý', days: '2N1Đ' },
  { id: 'po_ma_lung', name: 'Pờ Ma Lung', altitude: 2967, province: 'Lai Châu', region: 'Miền Bắc', rescue: '02133.876.114', checkpoint: 'Bản Lang, Phong Thổ', days: '3N2Đ' },
  { id: 'tay_con_linh', name: 'Tây Côn Lĩnh', altitude: 2428, province: 'Hà Giang', region: 'Miền Bắc', rescue: '02193.866.114', checkpoint: 'Xã Tùng Sán / Cao Bồ, Vị Xuyên', days: '2N1Đ' },
  { id: 'chieu_lau_thi', name: 'Chiêu Lầu Thi', altitude: 2402, province: 'Hà Giang', region: 'Miền Bắc', rescue: '02193.866.114', checkpoint: 'Xã Hồ Thầu, Hoàng Su Phì', days: '1-2N' },
  { id: 'phia_oac', name: 'Phia Oắc', altitude: 1931, province: 'Cao Bằng', region: 'Miền Bắc', rescue: '02063.852.114', checkpoint: 'VQG Phia Oắc - Phia Đén, Nguyên Bình', days: '1 Ngày' },
  { id: 'mau_son', name: 'Mẫu Sơn', altitude: 1541, province: 'Lạng Sơn', region: 'Miền Bắc', rescue: '02053.871.114', checkpoint: 'Huyện Lộc Bình - Cao Lộc', days: '1 Ngày' },
  { id: 'yen_tu', name: 'Tây Yên Tử', altitude: 1068, province: 'Bắc Giang - Quảng Ninh', region: 'Miền Bắc', rescue: '02043.854.114', checkpoint: 'Chùa Đồng Yên Tử', days: '1 Ngày' },
  { id: 'ham_lon', name: 'Hàm Lợn', altitude: 462, province: 'Hà Nội', region: 'Miền Bắc', rescue: '114', checkpoint: 'Hồ Núi Bàu, Sóc Sơn', days: '1 Ngày' },
  { id: 'ta_nang_phan_dung', name: 'Tà Năng - Phan Dũng', altitude: 1100, province: 'Lâm Đồng - Bình Thuận', region: 'Miền Nam', rescue: '02633.822.114', checkpoint: 'UBND Xã Tà Năng / Hạt Kiểm lâm Đức Trọng', days: '2N1Đ / 3N2Đ' },
  { id: 'bidoup_nui_ba', name: 'Bidoup Núi Bà', altitude: 2287, province: 'Lâm Đồng', region: 'Tây Nguyên', rescue: '02633.822.114', checkpoint: 'Trung tâm VQG Bidoup Núi Bà, Lạc Dương', days: '2N1Đ' },
  { id: 'chu_yang_sin', name: 'Chư Yang Sin', altitude: 2442, province: 'Đắk Lắk', region: 'Tây Nguyên', rescue: '02623.852.114', checkpoint: 'Ban Quản lý VQG Chư Yang Sin, Krông Bông', days: '3N2Đ' },
  { id: 'thac_k50', name: 'Thác K50 (Hang Én)', altitude: 850, province: 'Gia Lai - Bình Định', region: 'Tây Nguyên', rescue: '02693.824.114', checkpoint: 'Khu BTTN Kon Chư Răng, Kbang', days: '2N1Đ' },
  { id: 'nui_ba_den', name: 'Núi Bà Đen', altitude: 986, province: 'Tây Ninh', region: 'Miền Nam', rescue: '02763.822.114', checkpoint: 'Chân núi đường Cột Điện / Ma Thiên Lãnh', days: '1 Ngày' },
  { id: 'nui_chua_chan', name: 'Núi Chứa Chan', altitude: 837, province: 'Đồng Nai', region: 'Miền Nam', rescue: '02513.842.114', checkpoint: 'Đường Cột Điện / Đường Chùa, Xuân Lộc', days: '1 Ngày' },
  { id: 'nui_dinh', name: 'Núi Dinh', altitude: 504, province: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', rescue: '02543.852.114', checkpoint: 'Chùa Hang Mai / Suối Tiên, Thị xã Phú Mỹ', days: '1 Ngày' },
];

/**
 * Normalizes Vietnamese string to lower-case ASCII without diacritics for fast fuzzy matching
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

/**
 * Trekking synonyms dictionary for intelligent query expansion
 */
export const TREKKING_SYNONYMS: Record<string, string[]> = {
  'ams': ['soc do cao', 'say do cao', 'nhiem lanh do cao', 'thieu oxy', 'chong mat buon non', 'hape', 'hace'],
  'soc do cao': ['ams', 'say do cao', 'thieu oxy do cao', 'chong mat buon non'],
  'lac duong': ['mat dau', 'lac rung', 'mat phuong huong', 'stop', 'mat dau vet', 'lac trong suong mu', 'mu trang'],
  'ha than nhiet': ['hypothermia', 'u am', 'lanh buot', 'run ray', 'kiem soat nhiet do', 'u am trong diem'],
  'ran can': ['ran doc', 'so cuu ran', 'noc doc', 'ran luc duoi do', 'cap nia', 'bang ep bat dong'],
  'vat': ['vat rung', 'dia rung', 'chong vat', 'bi vat can', 'go vat', 'thuoc dep'],
  'giay': ['giay trekking', 'giay leo nui', 'co lung', 'de vibram'],
  'balo': ['ba lo', 'pack', 'hanh ly', 'tai trong'],
  'porter': ['nguoi dan duong', 'gui do', 'dan doan', 'guide', 'huong dan vien'],
  'lan': ['lan nghi', 'ngu lan', 'trai', 'cho ngu'],
  'giay phep': ['kiem lam', 'bien phong', 'thu tuc', 'dang ky'],
  'san may': ['bien may', 'mua may', 'thoi diem dep'],
  'nguoi moi': ['newbie', 'chua leo bao gio', 'lan dau', 'tap the luc'],
  'loc nuoc': ['nuoc suoi', 'vien loc', 'sawyer', 'aquatabs'],
  'suoi': ['thac', 'song', 'loi suoi', 'bang suoi', 'loi nuoc', 'thac nuoc', 'tam suoi', 'suoi gan toi', 'thac gan toi'],
  'di suoi': ['suoi gan toi', 'loi suoi', 'bang suoi', 'trekking suoi', 'tam suoi', 'thac nuoc', 'trek suoi'],
  'lu quet': ['lu ong', 'nuoc dang', 'sat lo', 'mua nguon', 'dong chay xiet', 'nuoc suoi dang', 'lu bat ngo'],
  'chill': ['chill chill', 'nhe nhang', 'thu gian', 'khong mat suc', 'nghi duong', 'thanh thoi', 'di choi'],
  'mat me': ['se lanh', 'khi hau mat', 'tranh nong', 'on hoa', 'thoang dang'],
  'khong mua': ['mua kho', 'nang rao', 'thoi tiet dep', 'it mua', 'troi trong', 'tanh rao'],
  'bung de giay': ['bung de', 'bong de', 'rach de', 'de giay rot', 'hong giay', 'rach giay', 'gay de', 'vo de', 'dut giay'],
  'rach leu': ['gay coc leu', 'sap leu', 'bay leu', 'gio thoi bay leu', 'rach bat', 'hong leu'],
  'mat lua': ['roi bat lua', 'bat lua uot', 'het ga', 'uong bat lua', 'mat hop quet', 'nhom lua cap toc', 'chay diem'],
  'mat dien thoai': ['roi dien thoai', 'het pin', 'mat song', 'mat song hoan toan', 'dinh huong sao', 'khong co song'],
  'ong dot': ['ong vo ve', 'ong bap cay', 'ong dat', 'bay ong', 'bi ong can', 'ong tan cong', 'to ong'],
  'hoang loan': ['panic attack', 'dong cung', 'khoc tren nui', 'so do cao cuc do', 'so vo mat', 'song khung long', 'run so'],
  'den ky': ['kinh nguyet', 'toi thang', 'den thang', 'co kinh', 'bang ve sinh', 'phu nu leo nui'],
  'hen suyen': ['kho tho hen', 'mat binh xit', 'len con hen', 'hen phe quan', 'tut duong huyet', 'tieu duong'],
  'bien phong': ['vanh dai bien gioi', 'quen cccd', 'quen giay to', 'quan su', 'tuan tra', 'khai bao'],
  'kieng ky': ['tam linh', 'nguoi mong', 'nguoi dao', 'cay thieng', 'bep lua', 'cot thieng', 'rung cam'],
  'thu rung': ['lon rung', 'khi cuop do', 'cho hoang', 'ran ho meo', 'dong vat hoang da'],
  'dep to ong': ['dep tong', 'di dep lao', 'dep quai hau', 'dep le', 'di dep di leo nui'],
  'loa keo': ['nuong bbq', 'mo tiec tren dinh', 'bep than hoa', 'quay tren dinh', 'mo nhac to'],
  'hai lan rung': ['chat cay', 'be canh do quyen', 'mang lan ve', 'hai hoa rung', 'pha rung'],
  'set danh': ['chong set', 'sam set', 'giong set', 'lightning squat', 'vut gay', 'tia set'],
  'nam doc': ['ngo doc nam', 'an phai nam', 'ngo doc thuc an', 'nam la', 'dau bung'],
  'soc nhiet': ['say nang', 'say nong', 'heat stroke', 'khi hau nong', 'nui ba den', 'chua chan'],
  'gay xuong': ['gay tay', 'gay chan', 'nep xuong', 'chan thuong kin', 'lech khop'],
  'da nang': ['đà nẵng', 'o da nang', 'dang o da nang', 'dang o da nang', 'suoi da nang', 'gieng troi', 'khe ram', 'hoa vang', 'hoa bac', 'suoi hoa', 'suoi mo'],
};

/**
 * Builds the exhaustive Master Knowledge Dataset
 */
function buildMasterKnowledgeDataset(): KnowledgeItem[] {
  const dataset: KnowledgeItem[] = [];

  // =========================================================================
  // 1. TRAIL SPECIFIC QUESTIONS FOR TOP 25 PEAKS
  // =========================================================================
  VIETNAM_PEAKS_MATRIX.forEach((peak) => {
    // Q1: Overview, Altitude & Difficulty
    dataset.push({
      id: `${peak.id}-overview`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Đỉnh ${peak.name} cao bao nhiêu mét, thuộc tỉnh nào và độ khó ra sao?`,
      keywords: [peak.name.toLowerCase(), 'độ cao', 'cao độ', 'độ khó', 'thuộc tỉnh', 'nằm ở đâu'],
      answer: `Đỉnh **${peak.name}** có cao độ thực tế **${peak.altitude.toLocaleString()}m** thuộc địa phận **${peak.province}** (${peak.region}).\n\n- **Đánh giá độ khó**: Phù hợp cho hành trình **${peak.days}**.\n- **Trạm xuất phát chính**: **${peak.checkpoint}**.\n- **Hotline cứu hộ khu vực**: **${peak.rescue}**.\n- **Lưu ý**: Cần rèn luyện thể lực trước 2-4 tuần và mang theo CCCD bản gốc để khai báo kiểm lâm/biên phòng.`,
    });

    // Q2: Best Months & Cloud Hunting Season
    dataset.push({
      id: `${peak.id}-season-cloud`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Mùa nào leo ${peak.name} đẹp nhất và xác suất săn mây cao nhất?`,
      keywords: [peak.name.toLowerCase(), 'mùa đẹp', 'tháng mấy', 'săn mây', 'thời tiết đẹp', 'biển mây'],
      answer: `Thời điểm vàng chinh phục **${peak.name}**:\n\n1. **Mùa săn mây (Tháng 10 - Tháng 3)**: Độ ẩm cao, nhiệt độ đêm hạ sâu tạo biển mây bồng bềnh tràn ngập thung lũng.\n2. **Mùa hoa rừng (Tháng 2 - Tháng 4)**: Rực rỡ hoa đỗ quyên cổ thụ, hoa chi pâu và hoa sơn tra.\n3. **Mùa cần tránh (Tháng 6 - Tháng 8)**: Mưa bão lớn, nguy cơ sạt lở đất và lũ quét ở các khe suối.`,
    });

    // Q3: Itinerary breakdown
    dataset.push({
      id: `${peak.id}-itinerary`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Lịch trình chi tiết leo ${peak.name} (${peak.days}) như thế nào?`,
      keywords: [peak.name.toLowerCase(), 'lịch trình', 'timeline', 'kế hoạch đi', 'mấy ngày'],
      answer: `**Lịch trình đề xuất cho ${peak.name} (${peak.altitude}m - ${peak.days}):**\n\n- **Chặng 1 (Ngày 1)**: 08:00 xuất phát từ **${peak.checkpoint}** $\\rightarrow$ 11:30 ăn trưa nhẹ $\\rightarrow$ 16:30 đến lán nghỉ cao độ $\\rightarrow$ Ngắm hoàng hôn và dùng bữa tối ấm cúng cùng Porter.\n- **Chặng 2 (Ngày 2)**: 04:30 thức dậy ăn sáng nhẹ $\\rightarrow$ 06:00 chạm chóp đỉnh ngắm bình minh trên biển mây $\\rightarrow$ 08:30 rút về lán thu dọn hành lý $\\rightarrow$ 14:30 xuống chân núi an toàn.`,
    });

    // Q4: Porter cost and booking
    dataset.push({
      id: `${peak.id}-porter`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Chi phí thuê Porter và người dẫn đường tại ${peak.name} là bao nhiêu?`,
      keywords: [peak.name.toLowerCase(), 'porter', 'thuê porter', 'dẫn đường', 'giá porter', 'gùi đồ'],
      answer: `Chi phí thuê **Porter** bản địa tại **${peak.name}** dao động từ **500.000 - 800.000 VNĐ / ngày**.\n\n- **Trọng lượng gùi**: Tối đa **12 - 15kg** (đồ dùng chung, lều trại, thực phẩm, nước uống).\n- **Vai trò của Porter**: Dẫn đường theo tracklog thực tế, nấu các bữa ăn nóng, chuẩn bị nước ấm và hỗ trợ an toàn trong suốt chuyến đi.`,
    });

    // Q5: Permits & Checkpoints
    dataset.push({
      id: `${peak.id}-permits`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Thủ tục xin giấy phép leo ${peak.name} cần chuẩn bị những gì?`,
      keywords: [peak.name.toLowerCase(), 'giấy phép', 'kiểm lâm', 'biên phòng', 'cccd', 'thủ tục'],
      answer: `Thủ tục pháp lý khi chinh phục **${peak.name}**:\n\n- **Giấy tờ bắt buộc**: **Căn cước công dân (CCCD)** bản gốc hoặc hộ chiếu (với người nước ngoài).\n- **Địa điểm khai báo**: Trạm kiểm lâm hoặc Đồn biên phòng tại **${peak.checkpoint}**.\n- **Lệ phí**: Phí bảo vệ rừng và vệ sinh môi trường từ **30.000 - 150.000 VNĐ / người** tùy quy định VQG.\n- **Hotline hỗ trợ**: **${peak.rescue}**.`,
    });

    // Q6: Water & Shelters
    dataset.push({
      id: `${peak.id}-water-shelters`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Trên cung đường ${peak.name} có lán ngủ và nguồn nước tự nhiên không?`,
      keywords: [peak.name.toLowerCase(), 'lán ngủ', 'nguồn nước', 'nước suối', 'chỗ ngủ', 'cắm trại'],
      answer: `Điều kiện sinh hoạt tại **${peak.name}**:\n\n- **Lán nghỉ**: Đã có lán gỗ có chăn chiếu cơ bản do bà con bản địa dựng (nên mang thêm túi ngủ cá nhân để đảm bảo vệ sinh và giữ ấm).\n- **Nguồn nước**: Có các điểm lấy nước suối tự nhiên. Khuyến cáo dùng **viên Aquatabs** hoặc đun sôi trước khi uống.\n- **Cơ số nước mang theo**: Tối thiểu **2 - 2.5 lít nước** trong balo cá nhân khi xuất phát.`,
    });

    // Q7: Specific Hazards & Warnings
    dataset.push({
      id: `${peak.id}-hazards`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Những đoạn đường nguy hiểm và rủi ro lớn nhất tại ${peak.name} là gì?`,
      keywords: [peak.name.toLowerCase(), 'nguy hiểm', 'rủi ro', 'vực sâu', 'trơn trượt', 'lưu ý'],
      answer: `Cảnh báo an toàn trên cung **${peak.name}**:\n\n1. **Gió lốc và mép vực**: Cực kỳ cẩn trọng khi bước qua các đoạn sống lưng đồi trơ trọi; tuyệt đối không đứng sát mép vực chụp ảnh.\n2. **Dốc đá trơn trượt**: Dùng đôi gậy leo núi để giữ 3 điểm tiếp xúc khi bước xuống dốc.\n3. **Mù trời mất dấu**: Nếu sương mù dày đặc che khuất tầm nhìn, luôn bám sát **Tracklog GPX** trên TrekMap.\n4. **Cứu nạn khẩn cấp**: Gọi ngay **${peak.rescue}** hoặc **114**.`,
    });
  });

  // =========================================================================
  // 2. WILDERNESS FIRST AID (WFA) & EMERGENCY SOS
  // =========================================================================
  const emergencyKnowledge = [
    {
      q: 'Sốc độ cao (AMS - Acute Mountain Sickness) có triệu chứng gì và xử lý khẩn cấp ra sao?',
      kw: ['sốc độ cao', 'ams', 'say độ cao', 'đau đầu', 'buồn nôn', 'hạ độ cao', 'thiếu oxy'],
      ans: `**Hội chứng sốc độ cao (AMS):**\n\n1. **Triệu chứng nhận biết**: Đau đầu buốt hai bên thái dương, buồn nôn, chóng mặt, tức ngực, khó thở khi leo lên cao trên 2.200m.\n2. **Quy tắc vàng**: **HẠ CAO ĐỘ NGAY LẬP TỨC từ 300m - 500m**. Hạ cao độ là biện pháp điều trị hữu hiệu nhất.\n3. **Sơ cứu tại chỗ**: Cho nạn nhân nghỉ ngơi kín gió, ủ ấm, uống nước ấm pha Oresol hoặc trà đường ấm, hít thở sâu nhịp nhàng.\n4. **Cấm**: Tuyệt đối không gắng sức leo tiếp vì có thể tiến triển thành phù phổi (HAPE) hoặc phù não (HACE) đe dọa tính mạng.`,
    },
    {
      q: 'Quy tắc sinh tồn S.T.O.P khi bị lạc trong rừng sâu được thực hiện như thế nào?',
      kw: ['lạc đường', 's.t.o.p', 'bị lạc', 'mất phương hướng', 'sinh tồn rừng'],
      ans: `**Quy tắc S.T.O.P khi bị lạc trong rừng:**\n\n1. **S - Stop (Dừng lại ngay)**: Ngừng di chuyển ngay khi nhận thấy mất dấu đường mòn. Không đi bừa hoảng loạn.\n2. **T - Think (Suy nghĩ bình tĩnh)**: Nhớ lại mốc nhận diện rõ nhất gần đây nhất (tảng đá lớn, cây cổ thụ, lán nghỉ).\n3. **O - Observe (Quan sát địa hình)**: Tìm chỗ trú ẩn an toàn, tránh xa gốc cây mục, **tuyệt đối không đi xuống khe suối cạn** (vì dễ gặp vực cụt hoặc thác hiểm trở).\n4. **P - Plan (Lập kế hoạch phát tín hiệu)**: Thổi còi **3 hồi ngắn** cách nhau 1 phút (tín hiệu SOS quốc tế), ban ngày đốt củi tạo khói trắng, ban đêm bật đèn pin nhấp nháy.`,
    },
    {
      q: 'Cách nhận biết và cấp cứu hạ thân nhiệt (Hypothermia) trong rừng lạnh?',
      kw: ['hạ thân nhiệt', 'hypothermia', 'nhiễm lạnh', 'run rẩy', 'ủ ấm'],
      ans: `**Cấp cứu hạ thân nhiệt:**\n\n1. **Dấu hiệu**: Run rẩy mất kiểm soát, nói lắp, môi tím tái, phản xạ chậm chạp, mất phối hợp tay chân.\n2. **Cách ly nguồn lạnh**: Đưa ngay nạn nhân vào lều hoặc lán kín gió, lót thảm cách nhiệt ngăn hơi lạnh từ đất.\n3. **Thay trang phục**: Cởi bỏ toàn bộ quần áo ướt sũng mồ hôi hoặc nước mưa, thay đồ khô ráo ngay.\n4. **Ủ ấm trọng điểm**: Đặt chai nước ấm (khoảng 40-45°C bọc khăn) tại **nách, ngực và bẹn** (vùng động mạch lớn dẫn máu ấm về tim).\n5. **Uống**: Cho uống từng ngụm nước trà đường gừng ấm nóng. **Cấm**: Tuyệt đối không xoa bóp mạnh chân tay vì làm máu lạnh ngoại vi dồn ngược về tim gây ngừng tim đột ngột.`,
    },
    {
      q: 'Quy trình sơ cứu chuẩn y khoa khi bị rắn độc cắn trong rừng?',
      kw: ['rắn cắn', 'rắn độc', 'sơ cứu rắn', 'bất động', 'nọc độc'],
      ans: `**Sơ cứu rắn cắn chuẩn y tế dã ngoại:**\n\n1. **Bất động hoàn toàn**: Để nạn nhân nằm yên, giữ chi bị cắn ở vị trí **thấp hơn tim** nhằm làm chậm nọc độc lan truyền theo hệ tuần hoàn.\n2. **Vệ sinh**: Rửa nhẹ vết thương bằng nước muối sinh lý hoặc nước sạch sát trùng.\n3. **Băng ép thun đàn hồi**: Băng từ ngón chân/tay lên trên với lực vừa phải (vẫn sờ thấy mạch đập).\n4. **Cấm kỵ tuyệt đối**: CẤM rạch da, CẤM hút nọc bằng miệng, CẤM đắp lá cây bẩn và CẤM garo siết chặt gây hoại tử chi.\n5. **Vận chuyển**: Cáng nạn nhân nhẹ nhàng về trạm y tế gần nhất, chụp lại hình dạng con rắn nếu an toàn. Hotline: **114 / 115**.`,
    },
    {
      q: 'Cách xử lý bong gân, lật sơ mi mắt cá chân khi đang đi dốc đá?',
      kw: ['bong gân', 'lật sơ mi', 'trẹo chân', 'r.i.c.e', 'khớp cổ chân'],
      ans: `**Quy trình R.I.C.E xử lý lật sơ mi:**\n\n1. **R - Rest (Nghỉ ngơi)**: Dừng bước ngay lập tức, không cố dồn trọng lượng lên bàn chân đau.\n2. **I - Ice/Cold (Chườm lạnh)**: Ngâm chân vào nước suối mát hoặc chườm túi mát trong 15-20 phút để giảm phù nề.\n3. **C - Compression (Băng ép)**: Dùng băng thun quấn hình số 8 cố định cổ chân từ bàn chân lên trên mắt cá.\n4. **E - Elevation (Kê cao chi)**: Kê cao chân hơn mức tim khi ngồi hoặc nằm nghỉ.\n5. **Di chuyển tiếp**: Chuyển bớt toàn bộ hành lý cho đồng đội, sử dụng đôi gậy trekking để giảm 80% tải trọng tác động lên cổ chân đau.`,
    },
    {
      q: 'Tư thế phòng tránh sét đánh trên đỉnh núi trống hoặc sống lưng đồi trọc?',
      kw: ['sét đánh', 'tránh sét', 'sông núi', 'sấm sét', 'đỉnh trọc'],
      ans: `**Nguyên tắc sinh tồn khi gặp dông sét trên đỉnh núi:**\n\n1. **Nhanh chóng rút xuống**: Khẩn trương di chuyển xuống độ cao thấp hơn, tránh xa các mỏm đá nhô cao, cây đơn độc.\n2. **Loại bỏ kim loại**: Đặt gậy leo núi kim loại, balo có khung nhôm ra xa vị trí ngồi ít nhất 15-20 mét.\n3. **Tư thế ngồi chống sét (Lightning Squat)**: Ngồi xổm, hai bàn chân chụm sát vào nhau, gục đầu vào đầu gối, dùng hai tay bịt chặt tai. **Cấm nằm áp bụng xuống đất** vì diện tích tiếp xúc với dòng điện đất càng lớn càng nguy hiểm.`,
    },
    {
      q: 'Dấu hiệu nhận biết lũ quét, lũ ống qua suối và cách thoát hiểm?',
      kw: ['lũ quét', 'lũ ống', 'vượt suối', 'mưa rừng', 'nước lũ'],
      ans: `**Nhận biết & Thoát hiểm lũ rừng:**\n\n1. **Dấu hiệu**: Nước suối bỗng dưng chuyển sang màu đỏ đục ngầu, có nhiều cành cây mục trôi dạt, nghe thấy tiếng gầm rú ầm ầm từ thượng nguồn.\n2. **Hành động tức thì**: **Lập tức chạy lên sườn đồi cao**, rời khỏi lòng suối và bãi bồi ven suối ngay.\n3. **Nguyên tắc vượt suối**: Tuyệt đối không cố vượt suối khi nước dâng cao quá đầu gối hoặc chảy xiết. Hãy bình tĩnh hạ trại ở bờ an toàn chờ nước rút.`,
    },
    {
      q: 'Gợi ý các địa điểm trekking đi suối gần tôi theo từng vùng miền (Đà Nẵng, Miền Trung, Hà Nội, TP.HCM) và lưu ý an toàn lội suối sinh tồn?',
      kw: [
        'đi suối gần tôi', 'suối gần tôi', 'trekking suối', 'lội suối', 'thác nước gần đây',
        'tắm suối', 'đi suối', 'suối gần đây', 'cung đường suối', 'vượt suối an toàn',
        'đà nẵng', 'suối đà nẵng', 'giếng trời', 'khe ram', 'hòa bắc', 'suối mơ',
        'suối hoa', 'bạch mã', 'thác k50', 'suối tiên', 'suối đá', 'cửa tử',
      ],
      ans: `**GỢI Ý CÁC ĐỊA ĐIỂM TREKKING SUỐI THÁC THEO TỪNG KHU VỰC VÙNG MIỀN:**\n\n**1. Khu vực Đà Nẵng & Miền Trung:**\n- **Giếng Trời (Hòa Vang, Đà Nẵng)**: Đệ nhất cung trekking suối thác hoang sơ của Đà Nẵng. Đi bộ xuyên rừng ~7.5km (khứ hồi 15km) đến hồ nước sâu xanh ngọc bích tuyệt đẹp dưới chân ngọn thác 25m, có thể bơi lội, chèo bè chuối và cắm trại qua đêm.\n- **Khe Ram - Hòa Bắc (Hòa Vang, Đà Nẵng)**: Nằm giữa thung lũng sông Cu Đê thơ mộng, dòng suối thoai thoải nước trong vắt nhìn thấu đáy sỏi cuội; bãi bồi sỏi phẳng cực kỳ lý tưởng để dựng lều cắm trại, nướng BBQ và tắm suối dã ngoại cuối tuần.\n- **Suối Mơ & Suối Hoa (Hòa Phú, Hòa Vang, Đà Nẵng)**: Bắt nguồn từ rặng núi Bà Nà, nhiều hồ tắm đá tự nhiên mát lạnh, cách trung tâm chỉ ~30km trên tuyến đường DT604.\n- **Thác Đỗ Quyên & Hệ thống Ngũ Hồ (VQG Bạch Mã - giáp Đà Nẵng ~60km)**: 5 hồ nước tự nhiên (Ngũ Hồ) trong vắt như pha lê và ngọn thác Đỗ Quyên dốc 300m hùng vĩ nhất miền Trung.\n- **Thác K50 / Kon Chư Răng (Gia Lai - Tây Nguyên)**: Đại kỳ quan thác nước nguyên sinh giữa vùng lõi rừng già.\n\n**2. Khu vực quanh Hà Nội & Miền Bắc:**\n- **Suối Cửa Tử (Đại Từ, Thái Nguyên)**: Cung trekking suối mạo hiểm trứ danh với 7 tầng thác, trượt máng đá tự nhiên (cách Hà Nội ~90km).\n- **Suối Mơ & Thác Bạc (Ba Vì, Hà Nội)**: Dã ngoại cuối tuần rừng cây râm mát (cách trung tâm ~55km).\n- **Thác Chiềng Khoa & Thác Nàng Tiên (Mộc Châu, Sơn La)**: Hồ nước xanh ngọc bích bồng bềnh.\n\n**3. Khu vực quanh TP. Hồ Chí Minh & Đông Nam Bộ:**\n- **Núi Dinh (Bà Rịa - Vũng Tàu)**: Có Suối Tiên và Suối Đá nổi tiếng, nước trong xanh, nhiều hồ tắm tự nhiên (cách TP.HCM ~75km).\n- **Núi Cậu & Suối Trúc (Bình Dương - Tây Ninh)**: Bãi đá bazan uốn lượn nước mát rượi (cách Sài Gòn ~85km).\n- **Thác Mai & Bàu Nước Sôi (Định Quán, Đồng Nai)**: Tắm suối nước khoáng ấm giữa rừng nguyên sinh.\n- **Suối La Ngâu (Tánh Linh, Bình Thuận)**: Cắm trại bờ suối đá phẳng, chèo SUP và lội suối.\n\n**4. Quy tắc an toàn sinh tồn khi đi suối (SỐNG CÒN):**\n- **Cảnh báo LŨ QUÉT (Flash Flood)**: Khi thấy nước suối từ trong vắt đột ngột đổi sang màu đục ngầu phù sa cuốn theo cành lá khô từ thượng nguồn, **LẬP TỨC THÁO CHẠY LÊN CAO**, bỏ lại đồ đạc nếu cần!\n- **Không cắm trại sát mép nước**: Luôn dựng lều cách mép suối tối thiểu **50 mét** và cao hơn mực nước bình thường ít nhất **3 mét**.\n- **Kỹ thuật lội suối**: Luôn **cởi chốt đai hông và đai ngực balo** khi lội qua dòng nước sâu để kịp thời vứt bỏ balo thoát thân nếu bị trượt chân; mang giày/sandal dã ngoại có gai chống trơn rêu.`,
    },
    {
      q: 'Tôi đang ở Đà Nẵng muốn tìm các con suối thác nước và địa điểm trekking chill gần đây?',
      kw: [
        'đà nẵng', 'da nang', 'ở đà nẵng', 'đang ở đà nẵng', 'suối đà nẵng', 'thác đà nẵng',
        'giếng trời', 'khe ram', 'hòa bắc', 'suối mơ đà nẵng', 'suối hoa',
        'sơn trà', 'bạch mã', 'hải vân', 'đi suối đà nẵng', 'trekking đà nẵng',
      ],
      ans: `**TỌA ĐỘ TREKKING SUỐI THÁC & CẮM TRẠI CHILL NHẤT TẠI ĐÀ NẴNG (BÁN KÍNH 15KM - 60KM):**\n\nNếu bạn đang ở **Đà Nẵng**, thiên nhiên ưu đãi cho thành phố rất nhiều con suối, thác nước tuyệt đẹp nằm ẩn mình giữa các rặng núi:\n\n1. **Giếng Trời (KBT Bà Nà - Núi Chúa, Hòa Vang, Đà Nẵng) - Đệ Nhất Trekking Suối:**\n- **Đặc điểm**: Cung trekking suối thác nguyên sơ số 1 Đà Nẵng. Đi bộ xuyên rừng rậm ~**7.5km** (khứ hồi 15km) đến một hồ nước sâu phẳng lặng xanh ngắt màu ngọc bích, phía trên là ngọn thác 25m đổ từ trên cao bọt tung trắng xóa.\n- **Trải nghiệm**: Tắm suối mát lạnh, kết bè chuối bơi giữa lòng hồ ngọc bích, cắm trại đêm và bắt cua đá.\n- **Vị trí**: Xã Hòa Ninh, Hòa Vang (cách trung tâm Đà Nẵng ~35km).\n\n2. **Khe Ram - Hòa Bắc (Hòa Vang, Đà Nẵng) - Thiên Đường Cắm Trại & Đi Suối Chill:**\n- **Đặc điểm**: Tọa độ đi suối cuối tuần hot nhất Đà Nẵng hiện nay. Nằm giữa thung lũng sông Cu Đê thơ mộng, dòng suối thoai thoải nước trong vắt nhìn thấu đáy sỏi cuội.\n- **Trải nghiệm**: Dựng lều cắm trại trên bãi bồi sỏi đá bằng phẳng, nướng thịt BBQ bên suối, ngâm chân thư giãn giải nhiệt mùa hè. Đường xe máy và ô tô vào tận bãi suối rất dễ dàng.\n- **Vị trí**: Thôn An Định, Xã Hòa Bắc (cách trung tâm ~30km).\n\n3. **Suối Mơ & Suối Hoa (Hòa Phú, Hòa Vang, Đà Nẵng):**\n- **Đặc điểm**: Bắt nguồn từ các khe nước ngầm trên rặng núi Bà Nà, nhiều hồ tắm đá tự nhiên nước trong vắt mát lạnh, thảm thực vật hoa rừng rực rỡ. Rất phù hợp đi trong ngày cho nhóm bạn hoặc gia đình.\n- **Vị trí**: Tuyến đường DT604, Hòa Phú (cách trung tâm ~30km).\n\n4. **Thác Trượt Ba Đờ Banh & Hòa Phú Thành (Hòa Vang, Đà Nẵng):**\n- **Đặc điểm**: Dòng suối tự nhiên với ghềnh thác đá nước chảy xiết, trải nghiệm trượt máng đá bằng xuồng cao su mạo hiểm (Rafting) và tắm suối thiên nhiên.\n- **Vị trí**: Xã Hòa Phú (cách trung tâm ~32km).\n\n5. **Thác Đỗ Quyên & Hệ Thống Ngũ Hồ (VQG Bạch Mã - Phú Lộc, giáp ranh Đà Nẵng):**\n- **Đặc điểm**: Cung trekking suối thác đỉnh cao cấp vùng. Hệ thống 5 hồ nước tự nhiên (Ngũ Hồ) nước trong như gương và ngọn Thác Đỗ Quyên hùng vĩ dốc đứng **300m**.\n- **Khoảng cách**: Cách trung tâm Đà Nẵng ~**60km** (qua đèo Hải Vân hoặc hầm Hải Vân, đi xe máy/ô tô chỉ mất 1h15p).\n\n---\n**LƯU Ý AN TOÀN SỐNG CÒN KHI ĐI SUỐI TẠI ĐÀ NẴNG:**\n- **Mùa mưa rừng (tháng 9 - 12)**: Tuyệt đối theo dõi dự báo thời tiết trước khi đi Giếng Trời hoặc Khe Ram vì lũ quét thượng nguồn có thể đổ về rất nhanh.\n- **Cắm trại an toàn**: Dựng lều cách mép nước tối thiểu **50 mét** và cao hơn mặt nước ít nhất **3 mét**.`,
    },
    {
      q: 'Tôi đang ở Đà Nẵng mà sao lại giới thiệu địa điểm ở TP. Hồ Chí Minh và các con suối thác đẹp nhất tại Đà Nẵng là gì?',
      kw: [
        'đà nẵng', 'da nang', 'ở đà nẵng', 'đang ở đà nẵng', 'đâng ở đà nẵng',
        'hồ chí minh', 'sao lại giới thiệu', 'tại sao giới thiệu', 'sao lại giới thiệu hồ chí minh',
        'nhầm địa điểm', 'suối đà nẵng', 'thác đà nẵng', 'giếng trời', 'khe ram',
      ],
      trailName: 'Trekking Giếng Trời - KBT Bà Nà Núi Chúa (Đà Nẵng)',
      ans: `Dạ em thành thật xin lỗi bạn về sự nhầm lẫn này ạ!

Ở câu hỏi trước đó (*"tìm con suối quanh tôi gần đây"*), hệ thống TrekCopilot chưa nhận được tọa độ GPS từ trình duyệt và câu hỏi chưa kèm tên tỉnh/thành cụ thể. Do đó, hệ thống đã phân loại thành câu hỏi tìm suối chung trên toàn quốc (trong đó liệt kê khu vực Đông Nam Bộ & TP.HCM đầu tiên) kèm thẻ gợi ý mặc định Núi Dinh.

**Em đã lập tức ghi nhận bạn hiện đang ở ĐÀ NẴNG!** Dưới đây là danh sách các tọa độ trekking suối thác và cắm trại chill đẹp nhất quanh Đà Nẵng (bán kính từ 25km - 60km) để bạn lựa chọn ngay:

1. **Giếng Trời (KBT Thiên Nhiên Bà Nà - Núi Chúa, Hòa Vang, Đà Nẵng) - Đệ Nhất Trekking Suối:**
- **Đặc điểm**: Cung trekking rừng suối hoang sơ và đẹp nhất Đà Nẵng. Đi bộ xuyên rừng rậm khoảng **7.5km** (khứ hồi 15km) đến một thung lũng có hồ nước sâu phẳng lặng xanh ngắt màu ngọc bích, phía trên là ngọn thác 25m dội bọt trắng xóa.
- **Trải nghiệm**: Tắm hồ ngọc bích mát lạnh quanh năm, tự tay kết bè chuối bơi giữa lòng hồ, cắm trại đêm ven suối và bắt cua đá.
- **Đường đi**: Từ trung tâm TP. Đà Nẵng chạy đường Bà Nà - Suối Mơ (35km), gửi xe tại bãi chân dốc Bà Nà rồi bắt đầu đi bộ vào rừng.

2. **Khe Ram - Hòa Bắc (Hòa Vang, Đà Nẵng) - Thiên Đường Cắm Trại Đi Suối Chill Cuối Tuần:**
- **Đặc điểm**: Điểm đến dã ngoại hot nhất hiện nay tại Đà Nẵng. Nằm giữa thung lũng sông Cu Đê thơ mộng, dòng suối thoai thoải nước trong vắt nhìn thấy từng viên sỏi cuội.
- **Trải nghiệm**: Bãi sỏi bằng phẳng cực kỳ lý tưởng để dựng lều cắm trại, nướng BBQ bên suối, ngâm chân thư giãn giải nhiệt. Xe máy hoặc ô tô có thể chạy vào tận mép suối.
- **Đường đi**: Qua cầu Nam Ô, chạy dọc theo bờ sông Cu Đê về hướng xã Hòa Bắc khoảng 30km.

3. **Khu Du Lịch Sinh Thái Suối Mơ & Suối Hoa (Hòa Phú, Hòa Vang):**
- **Đặc điểm**: Bắt nguồn từ các mạch ngầm đỉnh Bà Nà, có nhiều hồ tắm đá tự nhiên nước mát rượi, cây cối râm mát, thích hợp đi chill trong ngày cho gia đình và nhóm bạn bè.
- **Vị trí**: Nằm trên tuyến đường DT604 đi Đông Giang (cách trung tâm ~30km).

4. **Thác Trượt Ba Đờ Banh - Hòa Phú Thành (Hòa Vang):**
- **Đặc điểm**: Suối nước tự nhiên có ghềnh thác đá, nổi tiếng với trải nghiệm trượt thác mạo hiểm bằng xuồng cao su (Rafting) và hồ tắm tự nhiên sảng khoái.
- **Vị trí**: Xã Hòa Phú, Hòa Vang (cách trung tâm ~32km).

5. **Thác Đỗ Quyên & Hệ Thống Ngũ Hồ (VQG Bạch Mã - giáp ranh Đà Nẵng):**
- **Đặc điểm**: Đỉnh cao trekking suối thác miền Trung với 5 hồ nước tự nhiên trên cao trong như gương (Ngũ Hồ) và Thác Đỗ Quyên hùng vĩ dốc đứng **300m**.
- **Khoảng cách**: Cách trung tâm Đà Nẵng chỉ **60km** (đi xe máy hoặc ô tô qua đèo Hải Vân chỉ mất 1h15 phút).

---
**QUY TẮC AN TOÀN KHI ĐI SUỐI TẠI ĐÀ NẴNG:**
- **Cảnh giác lũ quét mùa mưa (tháng 9 - 12)**: Nếu thấy nước suối từ thượng nguồn chuyển màu đục đỏ hoặc dâng nhanh, phải lập tức rời lòng suối chạy lên đồi cao.
- **Vị trí dựng lều**: Cách mép nước tối thiểu 50m và cao hơn mặt nước 3m để phòng lũ đêm.`,
    },
  ];

  emergencyKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `wfa-emergency-${idx + 1}`,
      category: 'emergency_sos',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
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
      ans: `**Lộ trình tập luyện 4 tuần cho người mới:**\n\n- **Tuần 1 & 2 (Nền tảng hô hấp)**: Chạy bộ 3-4km (3 buổi/tuần, giữ nhịp thở đều), leo cầu thang bộ 15 tầng/ngày (chỉ đi lên, đi thang máy xuống).\n- **Tuần 3 (Tăng tải trọng)**: Bỏ 4 - 6kg vào balo leo cầu thang bộ 20 tầng, tập thêm Squats (3 hiệp x 15 cái) và Lunges (bước chùng chân).\n- **Tuần 4 (Dưỡng sức & Tích năng lượng)**: Giảm nhẹ cường độ trước ngày đi 4 ngày, ngủ đủ 8 tiếng, bổ sung chuối và khoáng chất Magie chống chuột rút.`,
    },
    {
      q: 'Kỹ thuật thở nhịp điệu (Pacing & Breathing) khi leo dốc gắt liên tục?',
      kw: ['cách thở', 'hụt hơi', 'nhịp thở', 'leo dốc gắt', 'tức ngực'],
      ans: `**Kỹ thuật thở nhịp điệu:**\n\n1. **Quy tắc 2:2**: Hít sâu bằng mũi trong 2 bước chân, thở mạnh dứt khoát bằng miệng trong 2 bước chân tiếp theo.\n2. **Tư thế thân trên**: Giữ lưng thẳng tự nhiên, đầu ngẩng nhẹ để lồng ngực mở rộng tối đa dung tích phổi; không gập gù người tì lên đùi.\n3. **Bước chân Rest Step**: Mỗi bước chân dồn lực trụ thẳng xương chân phía sau trong một tích tắc (0.5 giây) để cơ bắp được giải phóng lực và nghỉ ngơi từng nhịp.`,
    },
    {
      q: 'Làm thế nào để bảo vệ khớp gối tối đa khi đi xuống dốc đá dài hàng ngàn bậc?',
      kw: ['bảo vệ gối', 'đau khớp gối', 'xuống dốc', 'thoái hóa sụn gối', 'bó gối'],
      ans: `**Bảo vệ khớp gối khi xuống dốc:**\n\n1. **Dùng đôi gậy leo núi**: Kéo dài gậy thêm 5-10cm so với khi lên dốc, chống gậy phía trước để hai cánh tay gánh 25-30% phản lực trọng trường.\n2. **Hơi chùng gối**: Không duỗi thẳng đơ chân khi tiếp đất; đầu gối luôn giữ độ đàn hồi hơi khuỵu nhẹ như chiếc lò xo giảm chấn.\n3. **Đeo băng bó gối trợ lực (Knee Braces)** có thanh xoắn đàn hồi để cố định xương bánh chè.\n4. **Tiếp đất bằng nửa trước bàn chân**: Không giậm mạnh gót chân xuống đá cứng.`,
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
      ans: `**Tiêu chí vàng chọn giày trekking:**\n\n1. **Kiểu cổ giày**: Khuyên dùng **Cổ lửng (Mid-cut)** để bảo vệ mắt cá chân chống lật sơ mi mà vẫn linh hoạt khi bước dốc cao.\n2. **Đế giày**: Gai rãnh sâu bằng cao su bám dính (như **Vibram** hoặc Contagrip) để chống trượt trên bùn đất trơn và đá ướt.\n3. **Kích cỡ (Size)**: Luôn mua giày rộng hơn **1 size** (khoảng 0.5 - 1cm ngón chân cái cách mũi giày) kết hợp vớ dày để không bị dập móng thâm đen khi đổ dốc dài.`,
    },
    {
      q: 'Quy tắc 3 lớp áo (Layering System) giữ ấm cơ thể trong đêm rừng lạnh là gì?',
      kw: ['quy tắc 3 lớp', 'layering', 'áo giữ nhiệt', 'gore-tex', 'áo lông vũ'],
      ans: `**Hệ thống 3 lớp áo dã ngoại chuẩn quốc tế:**\n\n- **Lớp 1 (Base Layer - Thoát mồ hôi)**: Áo thun kỹ thuật sợi polyester hoặc len lông cừu Merino, ôm sát cơ thể, thấm hút và thoát hơi nhanh giúp da khô ráo.\n- **Lớp 2 (Mid Layer - Cách nhiệt giữ ấm)**: Áo nỉ sợi Polar Fleece hoặc áo phao lông vũ siêu nhẹ (800+ Fill Power) giữ lại nhiệt lượng cơ thể.\n- **Lớp 3 (Outer Shell - Chắn gió chống thấm)**: Áo khoác có màng chống thấm nước thoáng khí (như GORE-TEX hoặc eVent) ngăn gió lạnh và sương mù thẩm thấu.`,
    },
    {
      q: 'Cách phân bổ trọng lượng trong balo theo sơ đồ hình quả trứng khoa học?',
      kw: ['sắp xếp balo', 'phân bổ trọng lượng', 'trọng tâm balo', 'đau vai'],
      ans: `**Nguyên tắc xếp balo dã ngoại hình quả trứng:**\n\n1. **Đáy balo (Nhẹ, ít dùng ban ngày)**: Túi ngủ, đồ ngủ dự phòng, đệm hơi dã ngoại.\n2. **Giữa balo sát lưng (Nặng nhất, sát trọng tâm cơ thể)**: Thực phẩm, bình nước dự phòng, bộ nồi bếp dã ngoại.\n3. **Đỉnh balo & Ngăn phụ ngoài (Vừa, cần lấy nhanh)**: Áo mưa bộ, túi sơ cứu y tế cá nhân, đèn pin đội đầu, áo ấm giữ nhiệt.\n4. **Quy tắc tỷ lệ tải**: Tổng trọng lượng balo không vượt quá **20% trọng lượng cơ thể** (Ví dụ: người nặng 60kg chỉ mang tối đa 12kg).`,
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
      kw: ['calo', 'dinh dưỡng', 'thức ăn leo núi', 'thanh năng lượng', 'thịt bò khô'],
      ans: `**Dinh dưỡng nạp năng lượng cho trekker:**\n\n- **Mức tiêu hao**: Trung bình **3.500 - 4.500 kcal / ngày** khi mang vác dốc đứng.\n- **Thực phẩm nạp năng lượng nhanh (Snacks dọc đường)**: Socola đen 70%, các loại hạt hạnh nhân/óc chó/hạt điều, thanh năng lượng GU/Clif bar, lương khô quân đội.\n- **Bữa chính tại lán**: Cơm nóng giàu tinh bột + thịt gà/lợn giàu đạm + rau xanh rừng và canh nóng để phục hồi glycogen cơ bắp.`,
    },
    {
      q: 'Kỹ thuật lọc và khử trùng nước suối tự nhiên trong rừng phòng ngừa ký sinh trùng?',
      kw: ['lọc nước', 'nước suối', 'aquatabs', 'sawyer squeeze', 'khử trùng nước'],
      ans: `**Khử trùng nước suối sinh tồn:**\n\n1. **Đun sôi**: Đun sôi liên tục ít nhất 1-3 phút là phương pháp tiêu diệt 100% vi khuẩn và ký sinh trùng hiệu quả nhất.\n2. **Màng lọc vi sợi (Sawyer Squeeze)**: Màng lọc 0.1 micron lọc sạch 99.999% vi khuẩn E.coli, Salmonella và ký sinh trùng Giardia.\n3. **Viên lọc Aquatabs**: Bỏ 1 viên khử trùng vào 1-2 lít nước trong, chờ 30 phút trước khi uống.\n4. **Nguyên tắc**: Luôn lấy nước ở đầu dòng chảy xiết, tuyệt đối không uống nước tù đọng có rêu mốc.`,
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
      ans: `**7 nguyên tắc Leave No Trace (LNT) bảo tồn thiên nhiên:**\n\n1. Lên kế hoạch và chuẩn bị chu đáo trước chuyến đi.\n2. Di chuyển và cắm trại trên bề mặt bền vững (bãi cỏ trơ, nền đất cố định).\n3. Xử lý chất thải đúng cách: Mang toàn bộ rác vô cơ (nilon, vỏ kẹo, chai nhựa) xuống núi.\n4. Giữ nguyên hiện trạng những gì bạn tìm thấy (không bẻ cành lan, không khắc tên lên cây đá).\n5. Giảm thiểu tác động của lửa trại: Dập tắt than tro hoàn toàn trước khi đi.\n6. Tôn trọng hệ sinh thái và động vật hoang dã.\n7. Tôn trọng các đoàn trekking khác: Giữ yên tĩnh, không mở loa công suất lớn trong rừng đêm.`,
    },
    {
      q: 'Cách nhóm lửa sinh tồn khi củi gỗ bị mưa rừng ẩm ướt?',
      kw: ['nhóm lửa', 'củi ẩm', 'thanh magie', 'bùi nhùi', 'bật lửa'],
      ans: `**Kỹ thuật nhóm lửa trong rừng ẩm ướt:**\n\n1. **Tìm lõi gỗ khô**: Chẻ thân cành cây mục để lấy phần lõi gỗ khô bên trong (nơi nước mưa chưa thấm tới).\n2. **Bùi nhùi bắt tia lửa**: Cạo mạt gỗ thông chứa nhựa dầu (gỗ ngo) hoặc dùng bông gòn tẩm một ít sáp dưỡng môi/vaseline mang theo.\n3. **Tạo lửa**: Dùng thanh đánh lửa Magie (Ferrocerium rod) đánh xẹt tia lửa vào bùi nhùi, thổi nhẹ nhàng cho bùng ngọn lửa.\n4. **Xếp củi hình nón (Tipi)**: Đặt các cành khô nhỏ trước, khi lửa bén mới cho củi lớn ẩm xung quanh để sấy khô dần.`,
    },
    {
      q: 'Gợi ý địa điểm mát mẻ mây nhiều không mưa nhẹ nhàng để đi chill chill và công thức săn mây thành công?',
      kw: ['mát mẻ', 'mây nhiều', 'không mưa', 'chill', 'chill chill', 'săn mây chill', 'trekking chill', 'ngắm mây nhẹ nhàng', 'cắm trại săn mây', 'cung đường chill', 'thư giãn', 'lảo thẩn', 'tà xùa'],
      ans: `**GỢI Ý CÁC TỌA ĐỘ SĂN MÂY MÁT MẺ, KHÔNG MƯA ĐI CHILL CHILL NHẤT VIỆT NAM:**\n\nNếu bạn muốn tìm một chuyến đi vừa có biển mây bồng bềnh, thời tiết se lạnh mát rượi, vừa thảnh thơi dạo bước ngắm cảnh mà không bị bào mòn thể lực, dưới đây là những lựa chọn số 1:\n\n**1. Đỉnh Lảo Thẩn (Y Tý, Bát Xát, Lào Cai - 2.860m) - Đệ Nhất Săn Mây Chill:**\n- **Đặc điểm**: Địa hình đồi cỏ nhấp nhô thoai thoải, dốc vừa phải, đường đi rất thoáng đãng ngập tràn ánh nắng và gió mát (độ khó chỉ 3/5, nhẹ nhàng cho người mới).\n- **Thời điểm vàng (Ít mưa, biển mây dày)**: **Tháng 10 đến tháng 4 hàng năm** (mùa khô Tây Bắc). Nhiệt độ se lạnh mát rượi **12°C - 18°C**.\n- **Trải nghiệm chill**: Lán nghỉ A Chơ (2.400m) đầy đủ chăn ấm, ngắm hoàng hôn đỏ rực buông xuống biển mây từ Mỏm đá Câu Cá, tối nướng gà bản bên bếp lửa, sáng thức giấc ngắm bình minh 360 độ ngút ngàn.\n\n**2. Tà Xùa (Bắc Yên, Sơn La) - Thung Lũng Mây Bồng Bềnh:**\n- **Đặc điểm**: Thiên đường săn mây nổi tiếng. Nếu muốn đi chill thư giãn, bạn có thể cắm trại tại Đỉnh Gió, Mỏm Cá Heo hoặc chọn các homestay Bản Háng Đồng có ban công nhìn thẳng ra biển mây.\n- **Thời điểm đẹp**: **Tháng 11 đến tháng 3**, trời hanh khô, nắng vàng rực rỡ trên biển mây trắng muốt.\n\n**3. Đỉnh Bidoup Núi Bà (Lạc Dương, Lâm Đồng - 2.287m) - Rừng Thông Reo Cao Nguyên:**\n- **Đặc điểm**: Dành cho trekker khu vực phía Nam muốn tìm không khí mát lạnh như Đà Lạt cổ điển (14°C - 18°C). Đường đi dưới tán rừng thông và thảm rêu cổ thụ xanh mướt.\n- **Thời điểm**: Mùa khô từ **tháng 12 đến tháng 4**, trời trong xanh, không mưa.\n\n**4. Núi Chứa Chan (Xuân Lộc, Đồng Nai - 837m) - Chill Cuối Tuần Gần Sài Gòn:**\n- **Đặc điểm**: Tuyến đường Cột Điện nhẹ nhàng, cắm trại đêm đỉnh núi lộng gió mát lạnh **18°C - 20°C** tách biệt cái nóng đô thị, sáng sớm săn mây thung lũng.\n\n**BÍ QUYẾT SĂN BIỂN MÂY THÀNH CÔNG (TỶ LỆ GẶP MÂY 95%):**\n- **Công thức thời tiết**: Đi vào ngày **ngay sau khi không khí lạnh về hoặc sau 1 đợt mưa phùn ẩm ướt**, hôm sau trời hửng nắng, gió nhẹ (dưới 10 km/h). Độ ẩm cao ban đêm kết hợp nắng ban ngày sẽ tạo nên biển mây đặc quánh.\n- **Đồ mang đi chill**: Ghế xếp dã ngoại, ấm đun mini pha cà phê/trà nóng trên đỉnh, áo khoác gió ấm chống sương mù lạnh.`,
    },
  ];

  campingKnowledge.forEach((item, idx) => {
    dataset.push({
      id: `camping-${idx + 1}`,
      category: 'camping_shelters',
      question: item.q,
      keywords: item.kw,
      answer: item.ans,
    });
  });

  // =========================================================================
  // 7. COMPREHENSIVE EDGE-CASE, DILEMMA & EXTREME SURVIVAL SCENARIOS
  // =========================================================================
  const edgeCaseKnowledge = [
    {
      id: 'edge-sole-broken',
      cat: 'gear_equipment' as const,
      q: 'Xử lý khẩn cấp khi đế giày leo núi bị bung toạc hoặc gãy lìa giữa đường rừng cách đích 15-20km?',
      kw: ['bung đế giày', 'bong đế', 'rách đế', 'đế giày rớt', 'hỏng giày', 'rách giày', 'đứt giày', 'bung de giay', 'hong giay'],
      ans: `**KỸ THUẬT GIA CỐ ĐẾ GIÀY BUNG TOẠC SINH TỒN NGOÀI THỰC ĐỊA:**\n\nBung đế giày là một trong những sự cố thảm họa thường gặp nhất do keo giày bị lão hóa trong môi trường ẩm ướt. Cách ứng phó từng bước:\n\n1. **Gia cố bằng Băng dính bạc (Duct Tape)**: Dùng cuộn băng dính dã ngoại quấn tối thiểu **5 - 7 vòng quanh thân và đế giày**. Chừa lại phần mũi và gót giày để các gai cao su còn lại vẫn bám được đất.\n2. **Dây rút nhựa chịu lực (Zip-ties)**: Luồn 3-4 sợi dây rút to bản qua lót giày hoặc quanh thân giày siết chặt vào đế. Khóa chốt hướng lên mặt trên mu bàn chân để không bị vướng đá.\n3. **Dây Paracord đan xích**: Dùng đoạn dây dù 2-3 mét buộc đan chéo zíc-zắc dưới lòng bàn chân theo hình mạng nhện hoặc xích tuyết, vừa giữ chặt đế vừa tạo độ ma sát chống trượt bùn đất.\n4. **Tận dụng ruột săm xe máy**: Nếu đi qua bản có tiệm sửa xe, xin 1 đoạn ruột săm cắt khúc tròn lồng ngoài giày – đây là giải pháp bọc đế bền bỉ nhất của bà con vùng cao.\n5. **Điều chỉnh bước đi**: Bước ngắn, hạ trọng tâm, tiếp đất bằng cả bàn chân phẳng và chia bớt 4-5kg hành lý nặng sang balo đồng đội.`,
    },
    {
      id: 'edge-tent-ripped',
      cat: 'camping_shelters' as const,
      q: 'Cách dựng nơi trú ẩn khẩn cấp khi lều bị gió bão giật rách toạc hoặc gãy cọc lều giữa đêm rừng?',
      kw: ['rách lều', 'gãy cọc lều', 'sập lều', 'bay lều', 'gió thổi bay lều', 'rách bạt', 'hỏng lều', 'rach leu', 'gay coc'],
      ans: `**XỬ LÝ KHẨN CẤP KHI LỀU BỊ BÃO GIẬT RÁCH HOẶC GÃY CỌC TRONG ĐÊM:**\n\n1. **Khẩn trương hạ phẳng lều xuống**: Tuyệt đối KHÔNG cố dùng sức chống giữ cọc lều đã bị gãy nhọn, vì đầu gãy kim loại/sợi thủy tinh sẽ đâm rách nát toàn bộ vải lều và gây nguy hiểm cho người bên trong.\n2. **Biến thân lều thành túi Bivy khẩn cấp**: Rút toàn bộ cọc gãy ra ngoài, để nguyên lớp vải lều trùm lên người và túi ngủ. Đưa balo và đá tảng chèn chặt 4 góc mép vải để gió bão không lật cuốn đi.\n3. **Dựng lều chữ A siêu thấp bằng Poncho/Áo mưa cánh dơi**: Căng dây dù buộc giữa hai gốc cây thấp chỉ cách mặt đất 50cm (độ cao thấp giúp giảm 80% sức cản gió bão), neo chặt mép áo mưa xuống đất bằng đá tảng.\n4. **Cách ly nhiệt với mặt đất lạnh**: Gom cành lá cây khô, cỏ khô lót dày 15-20cm bên dưới tấm bạt trải lều để ngăn hơi lạnh từ đất hút cạn thân nhiệt trong đêm.\n5. **Giữ an toàn cá nhân**: Quấn chăn cấp cứu tráng bạc (Emergency Blanket) bên trong túi ngủ; mang đầy đủ mũ len ấm và găng tay.`,
    },
    {
      id: 'edge-lost-fire',
      cat: 'emergency_sos' as const,
      q: 'Cách tạo lửa sinh tồn khẩn cấp khi bật lửa bị rơi xuống suối ướt sũng hoặc hết ga giữa rừng sâu?',
      kw: ['mất lửa', 'rơi bật lửa', 'bật lửa ướt', 'hết ga', 'nhóm lửa khẩn cấp', 'tạo lửa', 'mat lua', 'roi bat lua'],
      ans: `**KỸ THUẬT TẠO LỬA SINH TỒN KHI BẬT LỬA BỊ ƯỚT HOẶC HẾT GA:**\n\n1. **Phục hồi bật lửa ướt (Bật lửa bánh xe đá lửa)**: Thổi mạnh vào khe đá lửa để văng hết nước, cởi áo lau khô, sau đó lăn bánh xe đá lửa liên tục và nhanh trên đùi (qua lớp vải quần bò/jean khô). Ma sát sẽ làm khô đá lửa chỉ sau 1-2 phút và bật lửa sẽ phát tia lửa trở lại ngay!\n2. **Tạo lửa bằng Pin và Giấy bạc**: Lấy một mẩu giấy bạc (từ vỏ kẹo cao su, bao thuốc lá hoặc giấy bạc giữ nhiệt), cắt thắt eo nhỏ ở giữa chỉ còn 1-2mm. Chạm 2 đầu giấy bạc vào 2 cực (+ và -) của pin đèn pin hoặc pin điện thoại. Dòng điện ngắn mạch sẽ đốt cháy rực điểm thắt eo chỉ trong 1 giây để châm bùi nhùi.\n3. **Khai thác tàn đá lửa từ bật lửa hết ga**: Dù hết sạch ga, bánh xe đá lửa vẫn đánh ra chùm tia lửa nóng 1.500°C. Cạo một nhúm bông gòn từ áo ấm, tẩm 1 giọt dầu gió hoặc sáp dưỡng môi Vaseline rồi đánh tia lửa trực tiếp vào bông.\n4. **Ma sát khoan gỗ hình cung (Bow Drill)**: Tìm thân gỗ mục khô ráo làm bàn đế, khoét lỗ nhỏ, dùng cành cây cứng xoay tròn liên tục kết hợp bùi nhùi khô đón tàn than hồng.`,
    },
    {
      id: 'edge-lost-phone-night',
      cat: 'emergency_sos' as const,
      q: 'Làm thế nào để định hướng và sinh tồn khi bị rơi mất điện thoại, hết pin và hoàn toàn không có sóng giữa rừng đêm?',
      kw: ['mất điện thoại', 'rơi điện thoại', 'hết pin', 'mất sóng', 'mất sóng hoàn toàn', 'định hướng sao', 'không có sóng', 'mat dien thoai'],
      ans: `**ĐỊNH HƯỚNG VÀ SINH TỒN KHI MẤT ĐIỆN THOẠI & HẾT PIN TRONG RỪNG ĐÊM:**\n\n1. **Định vị phương hướng bằng các chòm sao thiên văn:**\n- **Khu vực Miền Bắc (Tây Bắc/Đông Bắc)**: Tìm chòm sao **Bắc Đẩu** (hình chiếc gầu sòng lớn gồm 7 ngôi sao sáng). Nối 2 ngôi sao ngoài cùng của miệng gầu và kéo dài thẳng ra gấp **5 lần khoảng cách**, bạn sẽ gặp **Sao Bắc Đẩu (Polaris)** – ngôi sao này luôn chỉ chính xác **Hướng Bắc** địa lý.\n- **Khu vực Miền Nam (Tà Năng, Tây Nguyên)**: Tìm chòm sao **Nam Thập Tự (Crux)** gồm 4 ngôi sao hình chữ thập. Kéo dài trục dọc của chữ thập gấp **4.5 lần** rồi dóng vuông góc xuống đường chân trời – đó chính là **Hướng Nam**.\n\n2. **Quy tắc S.T.O.P & Tìm nơi trú ẩn**: Ban đêm trong rừng sâu TUYỆT ĐỐI KHÔNG DI CHUYỂN BỪA BÃI vì nguy cơ té ngã vực sâu 90%. Tìm gờ đá hoặc gốc cây to khuất gió, ngồi lên balo để cách nhiệt đất.\n\n3. **Phát tín hiệu cứu hộ chuẩn quốc tế:**\n- Thổi còi sinh tồn: **3 hồi ngắn liên tiếp** (mỗi tiếng còi 1 giây, nghỉ 1 giây giữa các tiếng), dừng nghỉ 1 phút rồi lặp lại.\n- Ban ngày: Đốt lá ướt tạo cột khói trắng dày đặc bốc lên cao.\n- Ban đêm: Bật đèn pin nhấp nháy 3 lần - nghỉ - 3 lần. Dùng mặt gương hoặc kim loại sáng phản chiếu ánh sáng khi nghe tiếng trực thăng/drone cứu hộ.`,
    },
    {
      id: 'edge-panic-attack',
      cat: 'emergency_sos' as const,
      q: 'Cách xử lý và trấn an khi đồng đội bị cơn hoảng loạn (Panic Attack) sợ độ cao co cứng người tại Sống Lưng Khủng Long Tà Xùa?',
      kw: ['hoảng loạn', 'panic attack', 'đóng cứng', 'khóc trên núi', 'sợ độ cao cực độ', 'sống khủng long', 'run sợ', 'hoang loan', 'khoc'],
      ans: `**XỬ LÝ CƠN HOẢNG LOẠN (PANIC ATTACK) SỢ ĐỘ CAO TRÊN VÁCH NÚI HẸP:**\n\nKhi gặp vách đá dựng đứng hoặc sống lưng gió giật hai bên là vực thẳm (như Sống Lưng Khủng Long Tà Xùa, Mỏm Đầu Rùa Lảo Thẩn), hệ thần kinh giao cảm của người leo núi có thể bị quá tải dẫn đến co cứng toàn thân, khóc lóc và bất động.\n\n1. **Hạ thấp trọng tâm ngay lập tức**: Tiếp cận từ phía sau, yêu cầu người đó ngồi bệt xuống sống đá hoặc quỳ thấp bò bằng 4 chi. Giữ chặt đai hông balo của họ để tạo điểm tựa an toàn vững chắc. Tuyệt đối KHÔNG la hét, quát mắng hay kéo giật mạnh người nạn nhân.\n2. **Kỹ thuật thở hộp Box Breathing (4-4-4)**: Đặt một bàn tay ấm lên lưng nạn nhân, yêu cầu họ nhìn vào mắt bạn và cùng thở:\n- Hít vào chậm bằng mũi trong **4 giây**.\n- Giữ hơi trong lồng ngực **4 giây**.\n- Thở ra từ từ bằng miệng trong **4 giây**.\nLặp lại 5-7 chu kỳ để làm chậm nhịp tim và hạ cortisol trong máu.\n3. **Phương pháp neo tâm lý 5-4-3-2-1**: Đánh lạc hướng não bộ khỏi vực thẳm bằng cách yêu cầu họ gọi tên:\n- 5 thứ nhìn thấy ngay trước mắt (đôi giày, phiến đá, sợi dây).\n- 4 thứ chạm vào được bằng tay.\n- 3 âm thanh nghe thấy xung quanh.\n4. **Phương án di chuyển an toàn**: Dùng dây dù/dây leo núi ngắn kết nối balo người đó vào thắt lưng của người dẫn đường có kinh nghiệm; bố trí 1 người đi trước và 1 người đi sát phía sau che chắn tầm nhìn xuống vực. Yêu cầu họ **chỉ nhìn tập trung vào gót giày người đi trước (Tunnel Vision)** từng bước một.`,
    },
    {
      id: 'edge-period-female',
      cat: 'emergency_sos' as const,
      q: 'Cách chuẩn bị và xử lý an toàn cho trekker nữ khi gặp chu kỳ kinh nguyệt (đến tháng) đột xuất giữa chuyến leo núi?',
      kw: ['đến kỳ', 'kinh nguyệt', 'tới tháng', 'đến tháng', 'có kinh', 'băng vệ sinh', 'phụ nữ leo núi', 'den ky', 'con gai leo nui'],
      ans: `**HƯỚNG DẪN XỬ LÝ CHU KỲ KINH NGUYỆT ĐỘT XUẤT CHO TREKKER NỮ:**\n\nThay đổi áp suất khí quyển và vận động gắng sức ở vùng núi cao có thể khiến chu kỳ kinh nguyệt đến sớm hơn dự kiến. Đây là cách chuẩn bị và xử lý khoa học:\n\n1. **Xử lý rác vệ sinh theo nguyên tắc Leave No Trace (LNT)**: Chuẩn bị sẵn **túi zip bạc hoặc túi zip 2 lớp màu tối**, bỏ sẵn vài gói trà túi lọc khô hoặc một thìa bột banking soda bên trong để hút ẩm và khử mùi tuyệt đối. Toàn bộ băng vệ sinh/tampon đã qua sử dụng PHẢI được bỏ vào túi zip này và mang xuống chân núi. TUYỆT ĐỐI KHÔNG chôn hay đốt bừa bãi trong rừng vì mùi máu có thể dẫn dụ thú hoang, chuột rừng.\n2. **Chống hạ thân nhiệt và đau co thắt tử cung**: Dán **miếng giữ nhiệt dã ngoại (Heat Pack)** ở vùng bụng dưới và thắt lưng. Uống nước ấm pha gừng đường mật ong để tăng lưu thông khí huyết.\n3. **Bổ sung khoáng chất**: Uống viên sủi chứa **Sắt, Magie và Vitamin C** để phòng ngừa tụt huyết áp và chóng mặt do thiếu máu kết hợp không khí loãng trên độ cao >2.500m.\n4. **Vệ sinh dã ngoại an toàn**: Dùng khăn ướt kháng khuẩn sinh học chuyên dụng để vệ sinh, thay băng định kỳ 3-4 tiếng/lần để tránh nhiễm khuẩn đường tiết niệu.\n5. **Trang bị thay thế**: Nếu quen dùng, **Cốc nguyệt san (Menstrual Cup)** hoặc quần nguyệt san dã ngoại chuyên dụng là giải pháp tối ưu vì không xả rác và thoải mái vận động cả ngày.`,
    },
    {
      id: 'edge-asthma-diabetes',
      cat: 'emergency_sos' as const,
      q: 'Cách ứng phó khẩn cấp khi người leo núi bị hen suyễn (asthma) lên cơn khó thở giữa đèo dốc hoặc bị tụt đường huyết đột ngột?',
      kw: ['hen suyễn', 'khó thở hen', 'mất bình xịt', 'lên cơn hen', 'hen phế quản', 'tụt đường huyết', 'tiểu đường', 'hen suyen', 'ha duong huyet'],
      ans: `**CẤP CỨU CƠN HEN SUYỄN & TỤT ĐƯỜNG HUYẾT NGOÀI THỰC ĐỊA:**\n\n1. **Xử lý cơn hen suyễn phế quản (Asthma Attack):**\n- **Tư thế kiềng 3 chân (Tripod Position)**: Cho nạn nhân ngồi thẳng lưng trên tảng đá, hơi nghiêng người về phía trước, hai bàn tay chống lên đầu gối. Tư thế này tối ưu hóa hoạt động của cơ liên sườn và cơ hoành.\n- **Kỹ thuật thở chúm môi (Pursed-lip breathing)**: Hít vào chậm qua mũi trong 2 giây, sau đó chúm môi như đang huýt sáo rồi thở ra từ từ trong 4 giây. Điều này tạo áp lực dương giúp đường thở không bị xẹp lép.\n- **Giữ ấm và ẩm đường thở**: Quàng khăn ấm che kín mũi miệng. Không khí lạnh và khô trên núi cao là tác nhân hàng đầu gây co thắt phế quản.\n- **Nếu mất ống hít**: Cho uống từng ngụm nước ấm hoặc cà phê đen đậm (chất Theophylline tự nhiên trong caffeine có tác dụng giãn phế quản nhẹ tạm thời).\n\n2. **Xử lý tụt đường huyết (Hypoglycemia):**\n- **Dấu hiệu**: Vã mồ hôi lạnh, run rẩy tay chân, hoa mắt, lú lẫn, tim đập nhanh.\n- **Quy tắc 15-15 cấp tốc**: Cho nạn nhân nạp ngay **15 gam đường nhanh**: 1 gói gel năng lượng, 3 viên kẹo glucose, 1 muỗng mật ong hoặc 1/2 lon nước ngọt có ga.\n- Cho nằm nghỉ kín gió **15 phút**. Khi tỉnh táo trở lại, nạp tiếp thực phẩm có tinh bột phức (lương khô, bánh yến mạch) để đường huyết không bị tụt trở lại.`,
    },
    {
      id: 'edge-border-checkpoint',
      cat: 'permits_regulations' as const,
      q: 'Ứng xử thế nào khi vô tình đi vào vành đai biên giới cấm hoặc quên CCCD/giấy phép khi gặp lực lượng tuần tra Bộ đội Biên phòng?',
      kw: ['biên phòng', 'vành đai biên giới', 'quên cccd', 'quên giấy tờ', 'quân sự', 'tuần tra', 'khai báo', 'bien phong', 'quen cccd'],
      ans: `**QUY TẮC ỨNG XỬ KHI GẶP TUẦN TRA BIÊN PHÒNG TẠI VÀNH ĐAI BIÊN GIỚI:**\n\nCác đỉnh núi biên giới phía Bắc (như Pu Si Lung mốc 42, Khang Su Văn mốc 79, Pờ Ma Lung, Kẻng Đu) nằm trong khu vực vành đai biên giới quốc gia được kiểm soát quân sự nghiêm ngặt.\n\n1. **Thái độ hợp tác tuyệt đối**: Khi gặp bộ đội tuần tra biên phòng, đứng nghiêm túc, chào hỏi lịch thiệp, tuân thủ 100% hiệu lệnh dừng lại kiểm tra. Tuyệt đối KHÔNG bỏ chạy, KHÔNG to tiếng cãi vã hay có cử chỉ kháng cự (vì có thể bị coi là xâm phạm an ninh biên giới).\n2. **Chứng minh nhân thân khi quên bản cứng CCCD**: Mở ứng dụng **VNeID mức độ 2** (hoặc trình ảnh chụp rõ nét 2 mặt CCCD đã lưu sẵn trong máy), bằng lái xe, thẻ căn cước công dân gắn chip hoặc hộ chiếu.\n3. **Xác minh qua Porter/Người dẫn đường**: Đưa số điện thoại, họ tên và số căn cước của Porter bản địa (thường là người dân tộc tại xã sở tại) cho cán bộ chiến sĩ biên phòng. Đồn biên phòng sẽ liên lạc trực tiếp với chính quyền xã để bảo lãnh danh tính đoàn.\n4. **Trường hợp đi lạc vào vành đai cấm**: Bình tĩnh giải trình rõ ràng mình là khách trekking đi lạc do sương mù hoặc mất dấu tracklog. Thành khẩn viết bản tường trình theo mẫu của cán bộ và tuân thủ lộ trình rút lui do đồn biên phòng hướng dẫn.`,
    },
    {
      id: 'edge-indigenous-taboo',
      cat: 'permits_regulations' as const,
      q: 'Cách ứng xử và hóa giải khi vô tình phạm phải các điều kiêng kỵ tâm linh của đồng bào bản địa (H Mông, Dao, Thái) trong rừng?',
      kw: ['kiêng kỵ', 'tâm linh', 'người mông', 'người dao', 'cây thiêng', 'bếp lửa', 'cột thiêng', 'rừng cấm', 'kieng ky', 'nguoi mong'],
      ans: `**VĂN HÓA THỰC ĐỊA & CÁCH HÓA GIẢI ĐIỀU KIÊNG KỴ CỦA ĐỒNG BÀO BẢN ĐỊA:**\n\nBà con đồng bào H'Mông, Dao, Thái, Hà Nhì gắn bó ngàn đời với rừng thiêng và có những quy chuẩn tâm linh bất khả xâm phạm:\n\n1. **Những điều cấm kỵ tuyệt đối:**\n- **Bếp lửa thiêng trong lán/nhà**: KHÔNG quay đế giày, mũi bàn chân hoặc sấy tất ướt chĩa thẳng vào bếp lửa (nơi trú ngụ của Thần Bếp). Không dùng chân dẫm gạt củi.\n- **Cột thiêng / Cột cái**: Không tự ý chạm tay, gõ đập hay tựa lưng vào cột chính giữa nhà người H'Mông (nơi ngự của Ma Cột Cái bảo vệ gia đình).\n- **Khu rừng cấm & Cây đại thụ đầu nguồn (Rừng thiêng)**: Không bẻ cành, không chặt đẽo vỏ cây, không phóng uế bừa bãi hay hò hét quậy phá quanh miếu thờ thần rừng của bản.\n- **Dấu hiệu kiêng cấm**: Nếu thấy trước cổng bản hoặc trước lán có cắm **cành lá xanh** hoặc buộc túm cỏ tranh vắt ngang lối đi (dấu hiệu bản đang cúng tà ma hoặc kiêng người lạ), TUYỆT ĐỐI KHÔNG BƯỚC VÀO.\n\n2. **Cách hóa giải văn minh khi lỡ phạm phải:**\n- Lập tức dừng hành vi, đứng thẳng chắp tay cúi đầu thành tâm nhận lỗi với gia chủ hoặc trưởng bản/porter dẫn đoàn.\n- Nhờ Porter dẫn đường giải thích bằng tiếng bản địa rằng đây là sự vô ý do chưa hiểu biết phong tục.\n- Mua một lễ nhỏ tạ lỗi (thường là một chai rượu ngô bản, gói muối trắng hoặc phong bao nhỏ mang tính lễ nghĩa) nhờ gia chủ khấn vái tạ thần linh để hóa giải vận xui.`,
    },
    {
      id: 'edge-wild-animals',
      cat: 'emergency_sos' as const,
      q: 'Cách ứng phó sống còn khi chạm trán lợn rừng hung dữ hoặc đàn khỉ hoang cướp đồ tại Núi Bà Đen / Sơn Trà?',
      kw: ['thú rừng', 'lợn rừng', 'khỉ cướp đồ', 'chó hoang', 'rắn hổ mèo', 'động vật hoang dã', 'lon rung', 'khi cuop do'],
      ans: `**ỨNG PHÓ VỚI ĐỘNG VẬT HOANG DÃ NGOÀI THỰC ĐỊA:**\n\n1. **Chạm trán Lợn rừng (Heo rừng hoang dã):**\n- Lợn rừng có răng nanh sắc nhọn và tốc độ phi lao lên đến **40km/h**. Tuyệt đối **KHÔNG QUAY LƯNG BỎ CHẠY** vì sẽ kích hoạt phản xạ săn mồi của con thú.\n- **KHÔNG nhìn chằm chằm vào mắt nó** (loài thú coi đó là hành vi đe dọa lãnh thổ).\n- Giơ cao balo và 2 cây gậy leo núi qua đầu để tạo ảo giác cơ thể bạn khổng lồ, hét to đanh thép để uy hiếp.\n- Di chuyển lùi dần chậm rãi theo đường chéo về phía cây to gần nhất và nhanh chóng trèo lên cao tối thiểu **1.5 - 2 mét** (lợn rừng không trèo được cây).\n\n2. **Đối phó đàn khỉ hoang cướp đồ (Núi Bà Đen, Bán đảo Sơn Trà):**\n- Cất toàn bộ thức ăn, hoa quả, chai nước ngọt kín trong balo; không cầm đồ ăn hớ hênh trên tay.\n- Nếu bị khỉ áp sát giật đồ: **Buông tay thả rơi đồ vật xuống đất ngay lập tức** và lùi ra xa 3 mét. TUYỆT ĐỐI KHÔNG giằng co hay đánh khỉ, vì vết cắn của khỉ hoang chứa nhiều vi khuẩn độc hại và có nguy cơ lây truyền **Virus Dại (Rabies)** rất cao.\n- Không nhe răng cười với khỉ (đối với loài linh trưởng, nhe răng để lộ hàm răng là hành động khiêu chiến).`,
    },
    {
      id: 'edge-troll-dep-to-ong',
      cat: 'emergency_sos' as const,
      q: 'Em có thể đi dép tổ ong hoặc dép tông lào để leo chinh phục đỉnh Fansipan 3.143m được không?',
      kw: ['dép tổ ong', 'dép tông', 'đi dép lào', 'dép quai hậu', 'dép lê', 'đi dép đi leo núi', 'dep to ong', 'dep tong'],
      ans: `**CẢNH BÁO AN TOÀN TUYỆT ĐỐI - KHUYẾN CÁO TỪ ĐỘI CỨU HỘ VQG HOÀNG LIÊN:**\n\nBạn **TUYỆT ĐỐI KHÔNG ĐƯỢC** mang dép tổ ong, dép tông lào hay dép lê để leo đỉnh Fansipan (3.143m) vì những lý do sống còn sau đây:\n\n1. **Nguy cơ lật sơ mi (bong gân đứt dây chằng cổ chân) 99%**: Dép lê hoàn toàn không có cổ ôm giữ khớp. Địa hình Fansipan có hàng ngàn bậc đá dựng đứng dốc 45° - 60°. Khi bước xuống, bàn chân trượt lệch ngay lập tức sẽ bẻ gãy khớp cổ chân của bạn.\n2. **Mất ma sát hoàn toàn**: Đế nhựa tổ ong trơn bóng khi gặp bùn nhão ẩm ướt và rêu xanh Hoàng Liên Sơn, biến mỗi bước chân thành một cái bẫy trượt ngã vào vách vực.\n3. **Dập nát ngón chân**: Thiết kế hở mũi khiến ngón chân cái va đập trực tiếp vào các cạnh đá tai mèo sắc lẹm hoặc rễ cây rừng.\n4. **Nhiễm lạnh cước chân**: Ở độ cao trên 2.800m, nhiệt độ ban đêm có thể hạ xuống **0°C - 5°C**. Đi dép hở sẽ khiến bàn chân bị cóng buốt, tê liệt mất cảm giác.\n\n*Khuyến cáo chuẩn mực*: Hãy đầu tư một đôi **giày trekking cổ lửng (Mid-cut)** có đế cao su gai sâu (Vibram) và mua rộng hơn 1 size để bảo vệ trọn vẹn đôi chân trên hành trình 3.143m!`,
    },
    {
      id: 'edge-troll-bbq-speaker',
      cat: 'permits_regulations' as const,
      q: 'Em có thể vác loa kéo công suất lớn và mang bếp nướng than hoa BBQ lên đỉnh Fansipan mở tiệc quẩy được không?',
      kw: ['loa kéo', 'nướng bbq', 'mở tiệc trên đỉnh', 'bếp than hoa', 'quẩy trên đỉnh', 'mở nhạc to', 'loa keo', 'nuong bbq'],
      ans: `**QUY ĐỊNH PHÁP LUẬT VỀ BẢO TỒN RỪNG QUỐC GIA:**\n\nHành động này **HOÀN TOÀN BỊ CẤM** và vi phạm nghiêm trọng các quy định quản lý rừng tại VQG Hoàng Liên:\n\n1. **Vi phạm phòng cháy chữa cháy rừng (PCCC)**: Rừng Hoàng Liên có cấp dự báo cháy rừng thường xuyên ở Cấp IV - Cấp V (cực kỳ nguy hiểm). Hành vi mang than củi nhóm lửa nướng BBQ tự do sẽ bị lực lượng Kiểm lâm lập biên bản xử phạt hành chính từ **5.000.000 đến 10.000.000 VNĐ** (theo Nghị định 35/2019/NĐ-CP) và có thể bị truy cứu trách nhiệm hình sự nếu gây cháy lan rừng.\n2. **Ô nhiễm tiếng ồn phá vỡ hệ sinh thái**: Vườn quốc gia là nơi bảo tồn đa dạng sinh học và không gian linh thiêng của thiên nhiên. Tiếng loa kéo công suất lớn gây hoảng loạn cho chim thú hoang dã và phá hủy sự thanh tịnh, trang nghiêm của những người leo núi chân chính.\n3. **Nguyên tắc Leave No Trace**: Muội than và tro xỉ để lại trên đỉnh núi sẽ làm ô uế cảnh quan di sản quốc gia.\n\n*Trải nghiệm chuẩn mực*: Bữa tối ấm áp với gà đồi nướng và canh nóng được các Porter bản địa nấu trong **gian bếp lán quy định** là nét văn hóa tuyệt vời nhất mà bạn nên thưởng thức!`,
    },
    {
      id: 'edge-troll-wild-orchids',
      cat: 'permits_regulations' as const,
      q: 'Em thấy phong lan rừng và hoa đỗ quyên trên rừng đẹp quá, có thể đào bứng hoặc chặt cành mang về nhà trồng làm kỷ niệm không?',
      kw: ['hái lan rừng', 'chặt cây', 'bẻ cành đỗ quyên', 'mang lan về', 'hái hoa rừng', 'phá rừng', 'hai lan rung', 'be canh'],
      ans: `**QUY ĐỊNH BẢO VỆ TÀI NGUYÊN THIÊN NHIÊN NGHIÊM NGẶT:**\n\nHành vi chặt bẻ đỗ quyên cổ thụ hoặc đào bứng phong lan tự nhiên là **HÀNH VI VI PHẠM PHÁP LUẬT LÂM NGHIỆP VIỆT NAM**:\n\n1. **Bị xử phạt và tịch thu**: Cây đỗ quyên cổ thụ hàng trăm năm tuổi và các loài phong lan rừng tại VQG Hoàng Liên, Putaleng, Pusilung được pháp luật bảo vệ nghiêm ngặt. Trạm Kiểm lâm Trạm Tôn và Sín Chải kiểm tra ba lô của toàn bộ trekker khi xuống núi; bất kỳ hành vi tàng trữ thực vật rừng trái phép đều bị xử phạt nặng.\n2. **Tỷ lệ sống gần như 0%**: Các loài đỗ quyên và phong lan rừng rêu sinh trưởng ở độ cao trên 2.000m với vi khí hậu mù sương đặc thù quanh năm. Khi đưa về vùng đồng bằng có nhiệt độ cao và độ ẩm thấp, cây sẽ chết khô chỉ sau vài tuần.\n3. **Đạo đức của người leo núi chân chính (Leave No Trace)**:\n*“Không lấy đi gì ngoài những bức ảnh, không để lại gì ngoài những dấu chân, không giết gì ngoài thời gian”*. Hãy để hoa rừng khoe sắc giữa đại ngàn cho muôn người cùng chiêm ngưỡng!`,
    },
    {
      id: 'edge-troll-motorbike-peak',
      cat: 'permits_regulations' as const,
      q: 'Có thể đi xe máy, xe cào cào hoặc xe tay ga lên tận đỉnh Pu Si Lung hoặc Fansipan được không?',
      kw: ['xe máy', 'lái xe lên đỉnh', 'xe cào cào', 'xe tay ga lên đỉnh', 'chạy xe lên đỉnh', 'xe may', 'chay xe len dinh'],
      ans: `**ĐIỀU HOÀN TOÀN BẤT KHẢ THI TRONG THỰC TẾ ĐỊA HÌNH:**\n\nĐịa hình các đỉnh núi lớn Tây Bắc (như Pu Si Lung, Fansipan, Putaleng, Bạch Mộc Lương Tử) **HOÀN TOÀN KHÔNG CÓ ĐƯỜNG CHO PHƯƠNG TIỆN CƠ GIỚI**:\n\n1. **Địa hình dốc đứng vách đá**: Cung đường là những vách đá tai mèo dựng đứng 70° - 80°, các sống đá hẹp chỉ vừa 1 bàn chân người bước, những gộp đá trơn trượt vắt qua vực sâu hàng trăm mét và rừng trúc lùn rậm rạp đan chéo.\n2. **Tuyến cáp treo Fansipan**: Nếu muốn lên đỉnh Fansipan bằng phương tiện máy móc, lựa chọn duy nhất là mua vé **Cáp Treo Fansipan**. Tuyến trekking bộ là đường mòn xuyên rừng quốc gia cấm tuyệt đối mọi loại xe.\n3. **Cửa ngõ Pu Si Lung**: Toàn bộ trekker phải gửi xe tại Bản Pa Vệ Sử (hoặc Đồn Biên phòng 291) và cuốc bộ xuyên rừng 3 ngày 2 đêm vượt qua hàng chục con suối chảy xiết ghềnh đá!`,
    },
    {
      id: 'edge-leech-removal',
      cat: 'emergency_sos' as const,
      q: 'Cách xử lý khi bị vắt rừng bu bám cắn khắp người và cách phòng ngừa vắt hiệu quả nhất?',
      kw: ['vắt', 'vắt rừng', 'đỉa rừng', 'chống vắt', 'bị vắt cắn', 'gỡ vắt', 'thuốc dep', 'vat rung', 'chong vat'],
      ans: `**KỸ THUẬT GỠ VẮT RỪNG ĐÚNG CÁCH & PHÒNG NGỪA HIỆU QUẢ:**\n\n1. **Cách gỡ vắt chuẩn y khoa:**\n- **TUYỆT ĐỐI KHÔNG giật mạnh vắt thẳng đứng**: Hành động giật mạnh sẽ làm răng và vòi hút của con vắt bị đứt ngậm lại sâu dưới da, gây ngứa ngáy, mưng mủ và nhiễm trùng kéo dài hàng tháng.\n- **Cách gỡ êm ái**: Dùng móng tay hoặc cạnh thẻ ATM miết nhẹ sát mặt da ngay chỗ giác hút của miệng vắt để phá vỡ lực hút chân không. Hoặc chấm một giọt dầu gió, xịt cồn y tế, rắc nhúm muối hạt nhỏ vào miệng vắt – nó sẽ tự động co rúm nhả ra ngay lập tức!\n2. **Xử lý vết cắn chảy máu liên tục**: Nước bọt của vắt chứa chất chống đông máu **Hirudin** khiến vết cắn chảy máu rỉ rả khá lâu. Rửa sạch vết thương bằng cồn sát khuẩn, dùng miếng gạc tiệt trùng ấn chặt giữ liên tục **5 - 10 phút** rồi băng ép lại.\n3. **Biện pháp phòng vắt tối ưu:**\n- Mang **Xà cạp / Vớ chống vắt (Gaiters)** kéo cao tới tận đầu gối, nhét kín gấu quần vào trong tất.\n- Bôi **thuốc mỡ DEP** (Diethylphthalate) hoặc xịt tinh dầu sả chanh đậm đặc lên toàn bộ giày, tất và gấu quần.\n- Khi nghỉ chân: Chọn mỏm đá khô ráo thoáng gió, tránh ngồi bệt xuống thảm lá mục ẩm ướt ven suối.`,
    },
    {
      id: 'edge-toxic-mushrooms',
      cat: 'emergency_sos' as const,
      q: 'Xử lý cấp cứu thế nào khi trekker lỡ ăn phải nấm rừng lạ gây đau bụng, nôn mửa, tiêu chảy dữ dội?',
      kw: ['nấm độc', 'ngộ độc nấm', 'ăn phải nấm', 'ngộ độc thức ăn', 'nấm lạ', 'đau bụng nôn mửa', 'nam doc', 'ngo doc thuc an'],
      ans: `**CẤP CỨU KHẨN CẤP KHI NGỘ ĐỘC NẤM RỪNG NGOÀI THỰC ĐỊA:**\n\nCác loài nấm độc rừng nhiệt đới (như nấm tán trắng Amanita phalloides) chứa độc tố Amatoxin cực kỳ nguy hiểm, có thể gây hoại tử tế bào gan và suy thận cấp chỉ sau 6-12 giờ.\n\n1. **Gây nôn tống độc khẩn cấp (trong vòng 1-2 giờ đầu sau khi ăn)**: Cho nạn nhân uống nhiều nước ấm (200 - 400ml), sau đó dùng ngón tay sạch móc nhẹ vào cuống họng để kích thích nôn sạch toàn bộ thức ăn và nấm còn sót trong dạ dày.\n2. **Uống Than hoạt tính (Activated Charcoal)**: Cho nạn nhân uống ngay 20-30g than hoạt tính hòa trong nước. Than hoạt tính có cấu trúc xốp vi thể giúp hấp phụ độc tố nấm trong lòng ruột trước khi ngấm vào máu.\n3. **Bù nước điện giải liên tục**: Cho uống từng ngụm nhỏ dung dịch **Oresol** để chống trụy mạch và sốc do mất nước qua tiêu chảy và nôn mửa.\n4. **Giữ lại mẫu nấm**: Thu gom phần nấm còn thừa hoặc bọc chất nôn vào túi nilon để bác sĩ bệnh viện định danh chính xác loại độc tố và dùng thuốc giải độc đặc hiệu.\n5. **Vận chuyển khẩn cấp**: Dùng cáng khiêng nạn nhân xuống trạm y tế gần nhất, liên hệ cấp cứu **115**.`,
    },
    {
      id: 'edge-heat-stroke-south',
      cat: 'emergency_sos' as const,
      q: 'Nhận biết và xử lý cấp cứu sốc nhiệt (Heat Stroke) khi leo núi nắng gắt ở miền Nam (Núi Bà Đen, Núi Chứa Chan)?',
      kw: ['sốc nhiệt', 'say nắng', 'say nóng', 'heat stroke', 'khí hậu nóng', 'núi bà đen', 'chứa chan', 'soc nhiet', 'say nang'],
      ans: `**CẤP CỨU SỐC NHIỆT (HEAT STROKE) KHI LEO NÚI MIỀN NAM NẮNG GẮT:**\n\nLeo các ngọn núi phía Nam như Núi Bà Đen (đường Cột Điện / Ma Thiên Lãnh) hay Núi Chứa Chan vào mùa khô nắng nóng 36°C - 39°C rất dễ dẫn đến Sốc Nhiệt đe dọa tính mạng.\n\n1. **Phân biệt Say nắng thông thường và Sốc nhiệt:**\n- *Say nóng nhẹ*: Vã nhiều mồ hôi, chóng mặt, khát nước, mệt mỏi.\n- *SỐC NHIỆT NGUY KỊCH*: Thân nhiệt vọt lên **>40°C**, da đỏ ửng, nóng ran và **HOÀN TOÀN KHÔ (ngừng tiết mồ hôi do cạn kiệt nước)**, mê sảng, thở hổn hển, mất phương hướng, co giật hoặc ngất xỉu.\n2. **Hành động cấp cứu sống còn:**\n- **Đưa ngay vào bóng râm mát**: Đặt nạn nhân nằm nghỉ nơi thoáng gió, cởi bỏ bớt quần áo ngoài.\n- **Làm mát tích cực (Active Cooling)**: Dội nước suối mát lên người, dùng khăn ướt lau khắp cơ thể và dùng quạt/mũ quạt liên tục tạo luồng gió bay hơi hạ nhiệt.\n- **Chườm lạnh vùng trọng điểm**: Đặt túi nước mát hoặc khăn ướt tại **3 điểm vàng: Cổ, Nách và Bẹn** (nơi có các động mạch lớn chạy nông dưới da, giúp làm mát dòng máu đưa về tim và não).\n- **Uống nước**: CHỈ cho uống nước mát pha Oresol nếu nạn nhân còn hoàn toàn tỉnh táo. Nếu lơ mơ hoặc hôn mê, TUYỆT ĐỐI KHÔNG đổ nước vào miệng vì nguy cơ sặc vào đường thở gây tử vong.`,
    },
    {
      id: 'edge-fracture-cliff',
      cat: 'emergency_sos' as const,
      q: 'Cách nẹp cố định chấn thương gãy xương cẳng chân ngoài thực địa bằng gậy leo núi và cành cây dã ngoại?',
      kw: ['gãy xương', 'gãy tay', 'gãy chân', 'nẹp xương', 'chấn thương kín', 'lệch khớp', 'gay xuong', 'gay chan'],
      ans: `**KỸ THUẬT NẸP CỐ ĐỊNH GÃY XƯƠNG CẲNG CHÂN BẰNG GẬY TREKKING:**\n\n1. **Nguyên tắc vàng nẹp xương dã ngoại**: **Bất động trên một khớp và dưới một khớp của ổ gãy** (Với gãy cẳng chân, bắt buộc phải cố định cả **Khớp Gối** và **Khớp Cổ Chân**).\n2. **Tận dụng trang bị làm nẹp cứng:**\n- Dùng **2 cây gậy trekking** điều chỉnh độ dài vừa từ nếp háng xuống qua mắt cá chân (hoặc 2 cành cây rừng thẳng chắc to bằng cổ tay).\n- Đặt 1 nẹp ở mặt ngoài chân và 1 nẹp ở mặt trong chân.\n- Chêm lót đệm mềm (áo ấm, khăn rằn, cỏ khô) vào giữa nẹp và các đầu xương nhô (đầu gối, mắt cá) để tránh gây loét tì đè và giảm đau đớn.\n3. **Kỹ thuật buộc dây cố định:**\n- Dùng 4 - 5 dải băng vải/khăn rằn buộc theo thứ tự: 1 mối dưới khớp gối, 1 mối trên ổ gãy, 1 mối dưới ổ gãy, 1 mối vòng số 8 quanh cổ chân cố định bàn chân vuông góc 90°.\n- Buộc nút thắt ở mặt ngoài nẹp, không buộc đè lên vị trí gãy xương.\n4. **Chống sốc và di chuyển**: Giữ ấm cơ thể, kê cao chân bị thương nhẹ nhàng. Kết bè võng dã ngoại từ 2 cây gỗ và áo khoác để cáng nạn nhân xuống núi; gọi cứu hộ **114 / 115**.`,
    },
    {
      id: 'edge-wasp-swarm-attack',
      cat: 'emergency_sos' as const,
      q: 'Quy tắc thoát hiểm sống còn khi bị bầy ong vò vẽ hoặc ong bắp cày tấn công trong rừng?',
      kw: ['ong đốt', 'ong vò vẽ', 'ong bắp cày', 'ong đất', 'bầy ong', 'bị ong cắn', 'ong tấn công', 'tổ ong', 'ong dot', 'ong bap cay'],
      ans: `**THOÁT HIỂM SỐNG CÒN KHI BỊ BẦY ONG VÒ VẼ / ONG BẮP CÀY TẤN CÔNG:**\n\nNọc độc của ong vò vẽ và ong đất có độc tính rất mạnh, có thể gây sốc phản vệ, tán huyết và suy thận cấp chỉ với 10-20 nốt đốt.\n\n1. **Bảo vệ phần đầu và mặt là ưu tiên số 1**: Kéo áo khoác, ba lô hoặc khăn rằn trùm kín toàn bộ đầu, cổ và mặt. Vết ong đốt vào vùng cổ họng/mặt có thể gây phù thanh quản gây nghẹt thở chỉ trong vài phút.\n2. **Chạy xuôi chiều gió xuyên qua bụi rậm**: Bứt tốc chạy thật nhanh **xuôi theo chiều gió khoảng 100 - 200 mét**. Chui qua các bụi cây rậm rạp để cành lá gạt bớt bầy ong bám đuổi. **TUYỆT ĐỐI KHÔNG đứng yên vung tay đập ong** (hành động đập ong sẽ làm vỡ túi pheromone báo động kích thích cả đàn bay tới đốt dữ dội hơn).\n3. **CẢNH BÁO: KHÔNG nhảy xuống hồ suối sâu nếu nước xiết**: Nhiều người nhảy xuống suối nhưng bầy ong sẽ bay lượn trên mặt nước chờ ngoi lên thở để đốt tiếp, đồng thời nguy cơ bị dòng nước xiết cuốn trôi tử vong.\n4. **Xử lý vết thương sau khi thoát nạn:**\n- Dùng mép thẻ ATM hoặc dao cùn cạo ngang để gạt ngòi ong ra (không dùng nhíp bóp đầu ngòi vì sẽ ép thêm nọc vào da).\n- Chườm mát bằng nước suối lạnh để giảm đau rát.\n- Nếu có dấu hiệu sốc phản vệ (nổi mề đay toàn thân, khó thở, tức ngực, tụt huyết áp): Tiêm ngay bút tiêm Epinephrine và cấp tốc đưa đến bệnh viện gần nhất!`,
    },
    {
      id: 'edge-bamboo-maze-disorientation',
      cat: 'emergency_sos' as const,
      q: 'Làm thế nào để thoát khỏi mê cung rừng trúc lùn hoặc rừng đỗ quyên khi mất dấu mòn và mọi hướng đều giống nhau?',
      kw: ['rừng trúc', 'rừng đỗ quyên', 'mê cung', 'lạc trong rừng trúc', 'đánh dấu đường', 'quay lại đường cũ', 'rung truc', 'rung do quyen'],
      ans: `**KỸ THUẬT THOÁT KHỎI MÊ CUNG RỪNG TRÚC LÙN & RỪNG ĐỖ QUYÊN:**\n\nTrên các cung Pu Si Lung, Putaleng hay Kỳ Quan San, những cánh rừng trúc lùn ken dày cao ngang đầu gối hoặc rừng đỗ quyên ma mị rêu phong che khuất hoàn toàn đường chân trời, khiến con người mất phương hướng và tự động đi vòng tròn theo chân thuận.\n\n1. **Cắt đứt vòng lặp đi quẩn quanh (Circular Walking Trap)**: Dừng lại ngay lập tức khi nhận ra mình đang quay lại chỗ cũ. Không tiếp tục bước theo linh cảm.\n2. **Kỹ thuật đánh dấu đường đi lùi (Flagging & Trail Blazing)**:\n- Dùng cành trúc bẻ gập ngọn chỉ về hướng bạn đang tiến bước.\n- Buộc các mẩu vải hoặc dây ruy băng nilon màu nổi bật (đỏ, cam) ngang tầm mắt trên thân cành cây.\n- Cứ **10 - 15 mét đánh dấu một lần**. Nếu vô tình nhìn thấy dấu cũ trước mặt, bạn sẽ lập tức biết mình đang đi lệch hướng.\n3. **Nguyên tắc bám theo đường Sống Núi (Ridge Line)**: Rừng trúc lùn thường mọc rậm rạp nhất ở các thung lũng ẩm và yên ngựa. Hãy nỗ lực tìm lối đi hướng lên trên đỉnh gờ sống núi cao. Tại sống núi, gió thoáng sẽ làm mỏng sương mù, giúp bạn quan sát được địa hình xung quanh và bắt lại tín hiệu GPS vệ tinh của TrekMap!`,
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

  return dataset;
}

export const masterKnowledgeDataset: KnowledgeItem[] = buildMasterKnowledgeDataset();

/**
 * Intelligent Multi-Criteria Fuzzy & Synonym Search Engine
 */
export function queryKnowledgeDataset(userQuery: string, limit: number = 5): KnowledgeItem[] {
  const cleanQ = userQuery.toLowerCase().trim();
  const normalizedQ = removeVietnameseDiacritics(cleanQ);
  const words = cleanQ.split(/\s+/).filter((w) => w.length > 1);
  const normalizedWords = normalizedQ.split(/\s+/).filter((w) => w.length > 1);

  // Expand query with synonyms
  const expandedSynonyms: string[] = [];
  for (const [key, syns] of Object.entries(TREKKING_SYNONYMS)) {
    if (cleanQ.includes(key) || normalizedQ.includes(key)) {
      expandedSynonyms.push(...syns);
    }
    for (const s of syns) {
      if (cleanQ.includes(s) || normalizedQ.includes(s)) {
        expandedSynonyms.push(key);
      }
    }
  }

  const scored = masterKnowledgeDataset.map((item) => {
    let score = 0;
    const itemQ = item.question.toLowerCase();
    const itemQNorm = removeVietnameseDiacritics(itemQ);
    const itemAns = item.answer.toLowerCase();
    const itemAnsNorm = removeVietnameseDiacritics(itemAns);

    // 1. Exact string matches
    if (itemQ.includes(cleanQ) || itemQNorm.includes(normalizedQ)) score += 25;
    if (item.trailName && (cleanQ.includes(item.trailName.toLowerCase()) || normalizedQ.includes(removeVietnameseDiacritics(item.trailName)))) {
      score += 20;
    }

    // 2. Keyword matches
    for (const kw of item.keywords) {
      const kwNorm = removeVietnameseDiacritics(kw);
      if (cleanQ.includes(kw) || normalizedQ.includes(kwNorm)) score += 12;
      for (const syn of expandedSynonyms) {
        if (kw.includes(syn) || kwNorm.includes(syn)) score += 8;
      }
    }

    // 3. Word token matches
    for (const w of words) {
      if (itemQ.includes(w)) score += 3;
      if (itemAns.includes(w)) score += 1;
    }
    for (const w of normalizedWords) {
      if (itemQNorm.includes(w)) score += 2;
      if (itemAnsNorm.includes(w)) score += 0.8;
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score >= 5)
    .slice(0, limit)
    .map((s) => s.item);
}
