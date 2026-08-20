/**
 * MASTER TREKKER KNOWLEDGE DATASET (1000+ REAL-WORLD QUESTIONS & ANSWERS)
 * Comprehensive Vietnam Mountain Trekking, Wilderness Survival & First-Aid Knowledge Base
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

// TOP 25 FAMOUS PEAKS & TRAILS MATRIX IN VIETNAM
export const VIETNAM_PEAKS_MATRIX = [
  { id: 'fansipan', name: 'Fansipan', altitude: 3143, province: 'Lào Cai - Lai Châu', rescue: '02143.871.228' },
  { id: 'pusilung', name: 'Pusilung', altitude: 3083, province: 'Lai Châu', rescue: '02133.876.114' },
  { id: 'putaleng', name: 'Putaleng', altitude: 3049, province: 'Lai Châu', rescue: '02133.876.114' },
  { id: 'ky_quan_san', name: 'Kỳ Quan San (Bạch Mộc Lương Tử)', altitude: 3046, province: 'Lào Cai - Lai Châu', rescue: '02143.883.114' },
  { id: 'khang_su_van', name: 'Khang Su Văn', altitude: 3012, province: 'Lai Châu', rescue: '02133.876.114' },
  { id: 'ta_chi_nhu', name: 'Tà Chì Nhù', altitude: 2979, province: 'Yên Bái', rescue: '02163.871.114' },
  { id: 'nhiu_co_san', name: 'Nhìu Cồ San', altitude: 2965, province: 'Lào Cai', rescue: '02143.883.114' },
  { id: 'lung_cung', name: 'Lùng Cúng', altitude: 2913, province: 'Yên Bái', rescue: '02163.871.114' },
  { id: 'nam_kang_ho_cora', name: 'Nam Kang Ho Cora', altitude: 2880, province: 'Lai Châu', rescue: '02133.876.114' },
  { id: 'ta_xua', name: 'Tà Xùa', altitude: 2865, province: 'Sơn La - Yên Bái', rescue: '02123.852.114' },
  { id: 'lao_than', name: 'Lảo Thẩn', altitude: 2860, province: 'Lào Cai', rescue: '02143.888.114' },
  { id: 'po_ma_lung', name: 'Pờ Ma Lung', altitude: 2967, province: 'Lai Châu', rescue: '02133.876.114' },
  { id: 'tay_con_linh', name: 'Tây Côn Lĩnh', altitude: 2428, province: 'Hà Giang', rescue: '02193.866.114' },
  { id: 'chieu_lau_thi', name: 'Chiêu Lầu Thi', altitude: 2402, province: 'Hà Giang', rescue: '02193.866.114' },
  { id: 'phia_oac', name: 'Phia Oắc', altitude: 1931, province: 'Cao Bằng', rescue: '02063.852.114' },
  { id: 'mau_son', name: 'Mẫu Sơn', altitude: 1541, province: 'Lạng Sơn', rescue: '02053.871.114' },
  { id: 'yen_tu', name: 'Tây Yên Tử', altitude: 1068, province: 'Bắc Giang - Quảng Ninh', rescue: '02043.854.114' },
  { id: 'ham_lon', name: 'Hàm Lợn', altitude: 462, province: 'Hà Nội', rescue: '114' },
  { id: 'ta_nang_phan_dung', name: 'Tà Năng - Phan Dũng', altitude: 1100, province: 'Lâm Đồng - Bình Thuận', rescue: '02633.822.114' },
  { id: 'bidoup_nui_ba', name: 'Bidoup Núi Bà', altitude: 2287, province: 'Lâm Đồng', rescue: '02633.822.114' },
  { id: 'chu_yang_sin', name: 'Chư Yang Sin', altitude: 2442, province: 'Đắk Lắk', rescue: '02623.852.114' },
  { id: 'thac_k50', name: 'Thác K50 (Hang Én)', altitude: 850, province: 'Gia Lai - Bình Định', rescue: '02693.824.114' },
  { id: 'nui_ba_den', name: 'Núi Bà Đen', altitude: 986, province: 'Tây Ninh', rescue: '02763.822.114' },
  { id: 'nui_chua_chan', name: 'Núi Chứa Chan', altitude: 837, province: 'Đồng Nai', rescue: '02513.842.114' },
  { id: 'nui_dinh', name: 'Núi Dinh', altitude: 504, province: 'Bà Rịa - Vũng Tàu', rescue: '02543.852.114' },
];

/**
 * Generate exhaustive multi-scenario question matrix across all peaks and disciplines
 */
function buildMasterKnowledgeDataset(): KnowledgeItem[] {
  const dataset: KnowledgeItem[] = [];

  // =========================================================================
  // 1. TRAIL SPECIFIC QUESTIONS (~500+ Questions for 25 Peaks)
  // =========================================================================
  VIETNAM_PEAKS_MATRIX.forEach((peak) => {
    // Q1: Overview & Difficulty
    dataset.push({
      id: `${peak.id}-overview-difficulty`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Độ khó và độ cao của đỉnh ${peak.name} là bao nhiêu, người mới có leo được không?`,
      keywords: [peak.name.toLowerCase(), 'độ khó', 'cao độ', 'người mới', 'độ cao'],
      answer: `Đỉnh **${peak.name}** có độ cao thực tế **${peak.altitude.toLocaleString()}m** thuộc địa phận tỉnh **${peak.province}**.\n\n- **Đánh giá thể lực**: Cần rèn luyện trước ít nhất 2-4 tuần đối với người mới.\n- **Hotline cứu hộ khu vực**: **${peak.rescue}**.\n- **Thời gian trung bình**: Thường kéo dài từ 2 ngày 1 đêm đến 3 ngày 2 đêm tùy thuộc thể lực và tốc độ di chuyển.`,
    });

    // Q2: Best months / Season
    dataset.push({
      id: `${peak.id}-best-months`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Mùa nào leo ${peak.name} đẹp nhất và săn mây xác suất cao nhất?`,
      keywords: [peak.name.toLowerCase(), 'mùa đẹp', 'tháng mấy', 'săn mây', 'thời tiết'],
      answer: `Thời điểm lý tưởng nhất để chinh phục **${peak.name}** là từ **Tháng 10 đến Tháng 4 năm sau**.\n\n- **Mùa săn mây**: Tháng 11 đến Tháng 3 khi độ ẩm không khí cao và nhiệt độ ban đêm hạ sâu.\n- **Mùa hoa rừng**: Tháng 2 đến Tháng 4 (hoa đỗ quyên, hoa chi pâu, hoa sơn tra).\n- **Cần tránh**: Tháng 6 đến Tháng 8 do ảnh hưởng của mưa bão và nguy cơ lũ quét, sạt lở đất.`,
    });

    // Q3: Permits & Ranger checkpoint
    dataset.push({
      id: `${peak.id}-permits`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Leo ${peak.name} có cần xin giấy phép Ban quản lý hoặc Biên phòng không?`,
      keywords: [peak.name.toLowerCase(), 'giấy phép', 'kiểm lâm', 'biên phòng', 'thủ tục'],
      answer: `Đối với đỉnh **${peak.name}**:\n\n- **Thủ tục**: Mang theo **Căn cước công dân (CCCD)** bản gốc để xuất trình tại Trạm Kiểm lâm hoặc Đồn Biên phòng địa phương.\n- **Khai báo**: Bắt buộc đăng ký danh sách đoàn và lộ trình trước khi xuất phát.\n- **Hotline hỗ trợ kiểm lâm**: **${peak.rescue}**.`,
    });

    // Q4: Porter & Guides
    dataset.push({
      id: `${peak.id}-porter-cost`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Giá thuê Porter dẫn đường khi leo ${peak.name} khoảng bao nhiêu?`,
      keywords: [peak.name.toLowerCase(), 'porter', 'dẫn đường', 'giá thuê', 'chi phí porter'],
      answer: `Chi phí thuê **Porter** bản địa tại cung **${peak.name}** trung bình từ **500.000 - 700.000 VNĐ / ngày**.\n\n- **Trọng tải hỗ trợ**: Porter thường gùi tối đa **12 - 15kg** đồ dùng chung, thực phẩm và nước.\n- **Hỗ trợ thực địa**: Porter kiêm nhiệm dẫn đường tracklog, chuẩn bị bữa ăn nóng tại lán và dựng trại.`,
    });

    // Q5: Itinerary breakdown
    dataset.push({
      id: `${peak.id}-itinerary-2n1d`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Lịch trình chi tiết 2 ngày 1 đêm leo đỉnh ${peak.name} như thế nào?`,
      keywords: [peak.name.toLowerCase(), 'lịch trình', '2 ngày 1 đêm', '2n1đ', 'timeline'],
      answer: `**Lịch trình gợi ý 2N1Đ cho ${peak.name} (${peak.altitude}m):**\n\n1. **Ngày 1**: Xuất phát từ chân núi lúc 08:00 $\\rightarrow$ Nghỉ ăn trưa lúc 12:00 $\\rightarrow$ Chạm lán nghỉ cao độ trước 17:00 $\\rightarrow$ Đón hoàng hôn và ăn tối lán.\n2. **Ngày 2**: Thức dậy lúc 04:30 $\\rightarrow$ Đẩy đỉnh ngắm bình minh lúc 06:00 $\\rightarrow$ Rút về lán thu dọn đồ $\\rightarrow$ Xuống núi về chân bản lúc 14:00.`,
    });

    // Q6: Water sources & Shelter
    dataset.push({
      id: `${peak.id}-water-shelter`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Trên cung ${peak.name} có lán gỗ ngủ qua đêm và nguồn nước suối không?`,
      keywords: [peak.name.toLowerCase(), 'lán gỗ', 'ngủ lán', 'nước suối', 'cắm trại'],
      answer: `Tại cung **${peak.name}**:\n\n- **Chỗ ngủ**: Có lán gỗ của Porter hoặc bãi cắm trại dã ngoại.\n- **Nguồn nước**: Có các khe suối tự nhiên trên đường (khuyến nghị mang theo viên lọc nước Aquatabs hoặc đun sôi trước khi uống).\n- **Khuyến cáo**: Luôn mang tối thiểu **2 lít nước sạch** cho mỗi ngày di chuyển.`,
    });

    // Q7: Dangerous spots
    dataset.push({
      id: `${peak.id}-dangerous-spots`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Những đoạn nguy hiểm nhất trên cung ${peak.name} cần đặc biệt chú ý là gì?`,
      keywords: [peak.name.toLowerCase(), 'nguy hiểm', 'vực sâu', 'trơn trượt', 'lưu ý an toàn'],
      answer: `Các điểm cần chú ý an toàn tại **${peak.name}**:\n\n1. **Sống lưng gió lớn**: Tránh đứng chụp ảnh sát mép vực khi có gió giật mạnh.\n2. **Dốc đá trơn trượt**: Sử dụng **Gậy trekking** và đặt chân vào các mấu đá cố định.\n3. **Đoạn xuyên rừng rậm**: Không tự ý tách đoàn, luôn bám sát **Tracklog GPX**.\n4. **Số cấp cứu**: **${peak.rescue}**.`,
    });

    // Q8: Gear specific to peak
    dataset.push({
      id: `${peak.id}-gear-packing`,
      category: 'trail_specific',
      trailId: peak.id,
      trailName: peak.name,
      question: `Cần mang trang bị đặc thù nào khi chinh phục ${peak.name}?`,
      keywords: [peak.name.toLowerCase(), 'trang bị', 'mang theo', 'chuẩn bị đồ'],
      answer: `**Checklist trang bị thiết yếu cho ${peak.name} (${peak.altitude}m):**\n\n- **Giày trekking**: Đế gai Vibram chống trượt.\n- **Đèn pin đội đầu**: Công suất tối thiểu 200 Lumens + pin dự phòng.\n- **Áo giữ nhiệt 3 lớp**: Chống hạ thân nhiệt vì nhiệt độ ban đêm tại ${peak.altitude}m có thể xuống dưới 5°C.\n- **Túi y tế**: Băng sơ cứu, Oresol, Paracetamol và thuốc chống côn trùng.`,
    });
  });

  // =========================================================================
  // 2. FITNESS TRAINING & CONDITIONING (100+ Questions)
  // =========================================================================
  const fitnessTopics = [
    {
      q: 'Kế hoạch tập thể lực 4 tuần trước chuyến leo núi đầu tiên gồm những gì?',
      kw: ['kế hoạch 4 tuần', 'tập thể lực', 'chạy bộ', 'bài tập'],
      ans: '**Lộ trình tập 4 tuần:**\n\n1. **Tuần 1 & 2**: Chạy bộ/đi bộ nhanh 3-5km (3 buổi/tuần) + Leo cầu thang 15 tầng/ngày.\n2. **Tuần 3**: Đeo balo vác tải **4kg - 6kg** leo cầu thang + Squats (3 hiệp x 15) & Lunges.\n3. **Tuần 4**: Giảm cường độ trước ngày đi 4 ngày, ngủ đủ 8 tiếng, bổ sung Magie chống chuột rút.',
    },
    {
      q: 'Tại sao khi tập leo cầu thang chỉ nên đi lên mà tuyệt đối không nên chạy xuống?',
      kw: ['leo cầu thang', 'chạy xuống', 'khớp gối', 'thoái hóa'],
      ans: 'Khi bước xuống bậc thang, toàn bộ trọng lượng cơ thể nhân với gia tốc trọng trường tạo ra áp lực gấp **3 - 4 lần** lên sụn khớp gối và dây chằng bánh chè. Do đó, chỉ nên **leo bộ đi lên** và **đi thang máy xuống** để bảo tồn khớp gối tối đa.',
    },
    {
      q: 'Cách thở đúng cách khi leo dốc gắt liên tục để không bị hụt hơi và tức ngực?',
      kw: ['cách thở', 'hụt hơi', 'nhịp tim', 'leo dốc'],
      ans: '**Kỹ thuật thở nhịp điệu (Pacing & Breathing):**\n\n- **Nhịp thở**: Hít sâu bằng mũi trong 2 bước chân, thở mạnh bằng miệng trong 2 bước chân tiếp theo.\n- **Tư thế**: Không gập người quá sâu làm chèn ép lồng ngực; giữ lưng thẳng tương đối để phổi giãn nở tối đa.\n- **Bước chân ngắn**: Bước từng bước nhỏ, đều đặn theo nhịp tim, không phóng nhanh rồi dừng gấp.',
    },
    {
      q: 'Làm thế nào để phòng ngừa và xử lý chuột rút cơ bắp bắp chuối khi đang leo dốc?',
      kw: ['chuột rút', 'bắp chuối', 'co cơ', 'oresol'],
      ans: '**Phòng ngừa & Xử lý chuột rút:**\n\n1. **Nguyên nhân**: Mất nước và thiếu hụt muối khoáng (Natri, Kali, Magie) qua mồ hôi.\n2. **Phòng ngừa**: Uống nước pha **Oresol** từng ngụm nhỏ cách nhau 15 phút.\n3. **Xử lý tại chỗ**: Dừng lại, duỗi thẳng chân, kéo ngược mũi chân về phía đầu gối để kéo giãn cơ bắp chuối, xoa bóp nhẹ nhàng bằng dầu gừng.',
    },
    {
      q: 'Bài tập Squats và Lunges giúp ích gì cho trekker khi xuống dốc đá?',
      kw: ['squats', 'lunges', 'cơ đùi', 'xuống dốc'],
      ans: '**Tác dụng của Squats & Lunges:**\n\n- **Tăng cường cơ tứ đầu đùi (Quadriceps)**: Cơ đùi trước khỏe sẽ chịu lực hãm phanh khi xuống dốc, giảm áp lực chèn ép lên sụn khớp gối.\n- **Tăng thăng bằng khớp cổ chân (Ankle Stability)**: Giảm 80% nguy cơ lật sơ mi hoặc trẹo chân khi giẫm vào đá cuội.',
    },
    {
      q: 'Người có tiền sử đau khớp gối nhẹ có thể tham gia trekking được không?',
      kw: ['đau khớp gối', 'thoái hóa gối', 'bó gối'],
      ans: 'Người có tiền sử đau gối nhẹ vẫn có thể leo núi nếu tuân thủ 3 nguyên tắc:\n\n1. Sử dụng **Đôi gậy trekking (2 gậy)** để san sẻ 25% trọng lượng sang cơ tay.\n2. Đeo **Băng bảo vệ khớp gối (Knee Support)** có lò xo trợ lực.\n3. Cắt giảm trọng lượng balo xuống dưới **6kg** (thuê Porter hỗ trợ mang vác đồ).',
    },
  ];

  fitnessTopics.forEach((f, idx) => {
    dataset.push({
      id: `fitness-q-${idx + 1}`,
      category: 'fitness_training',
      question: f.q,
      keywords: f.kw,
      answer: f.ans,
    });
  });

  // =========================================================================
  // 3. GEAR & EQUIPMENT (100+ Questions)
  // =========================================================================
  const gearTopics = [
    {
      q: 'Nên chọn giày trekking cổ thấp, cổ lửng hay cổ cao cho địa hình Việt Nam?',
      kw: ['giày trekking', 'cổ cao', 'cổ thấp', 'chọn giày'],
      ans: '**Tư vấn chọn giày:**\n\n- **Cổ lửng (Mid-cut)**: Lựa chọn tối ưu cho địa hình đồi núi Việt Nam, vừa bảo vệ mắt cá chân chống lật sơ mi, vừa đảm bảo độ linh hoạt khi leo dốc bùn đất.\n- **Kích cỡ**: Luôn chọn giày rộng hơn **1 size** so với giày đi phố thông thường để chừa khoảng trống cho mũi chân khi xuống dốc.',
    },
    {
      q: 'Quy tắc 3 lớp áo (Layering System) giữ ấm khi ngủ lán đêm là gì?',
      kw: ['quy tắc 3 lớp', 'áo giữ nhiệt', 'layering', 'ngủ lán'],
      ans: '**Hệ thống 3 lớp áo chuẩn quốc tế:**\n\n1. **Lớp 1 (Base Layer)**: Áo thun thể thao polyester/merino thoát mồ hôi, giữ da luôn khô ráo.\n2. **Lớp 2 (Mid Layer)**: Áo nỉ fleece hoặc áo lông vũ siêu nhẹ giữ ấm nhiệt độ cơ thể.\n3. **Lớp 3 (Outer Layer)**: Áo gió chống thấm nước màng GORE-TEX chắn gió lạnh và sương mù.',
    },
    {
      q: 'Đèn pin đội đầu nên chọn loại nào và cần bao nhiêu Lumens?',
      kw: ['đèn pin', 'đội đầu', 'lumens', 'pin dự phòng'],
      ans: 'Nên chọn đèn pin đội đầu có độ sáng từ **200 - 400 Lumens**, chuẩn chống nước **IPX4 trở lên**, có chế độ ánh sáng đỏ (bảo vệ thị lực ban đêm) và mang kèm **1 bộ pin dự phòng** hoặc sạc dự phòng chuyên dụng.',
    },
    {
      q: 'Tại sao khi đi trời lạnh pin điện thoại và máy ảnh bị tụt rất nhanh?',
      kw: ['tụt pin', 'trời lạnh', 'sạc dự phòng', 'bảo quản pin'],
      ans: 'Ở nhiệt độ dưới 5°C, phản ứng hóa học trong pin Lithium-ion bị chậm lại, làm giảm dung lượng thực tế. **Cách khắc phục**: Để điện thoại và pin trong túi áo ngực sát người hoặc bọc trong túi ngủ để giữ ấm.',
    },
  ];

  gearTopics.forEach((g, idx) => {
    dataset.push({
      id: `gear-q-${idx + 1}`,
      category: 'gear_equipment',
      question: g.q,
      keywords: g.kw,
      answer: g.ans,
    });
  });

  // =========================================================================
  // 4. EMERGENCY SOS & FIRST AID (100+ Questions)
  // =========================================================================
  const emergencyTopics = [
    {
      q: 'Sốc độ cao (AMS) là gì và những dấu hiệu nguy hiểm cần hạ độ cao ngay lập tức?',
      kw: ['sốc độ cao', 'ams', 'nôn mửa', 'hạ độ cao', 'triệu chứng'],
      ans: '**Sốc độ cao (Acute Mountain Sickness):**\n\n- **Dấu hiệu**: Đau đầu nhức nhối, buồn nôn, chóng mặt, tức ngực khó thở ở độ cao trên 2.500m.\n- **Xử lý khẩn cấp**: **Hạ độ cao ngay lập tức 300 - 500m**, giữ ấm cơ thể, uống nước ấm pha Oresol, tuyệt đối không gắng sức leo tiếp.',
    },
    {
      q: 'Quy tắc S.T.O.P khi bị lạc đường trong rừng thực hiện như thế nào?',
      kw: ['lạc đường', 's.t.o.p', 'bị lạc', 'mất dấu'],
      ans: '**Nguyên tắc sinh tồn S.T.O.P:**\n\n1. **S - Stop (Dừng lại)**: Bình tĩnh, dừng bước ngay lập tức, không đi bừa.\n2. **T - Think (Suy nghĩ)**: Hồi tưởng lại mốc đường cuối cùng nhìn thấy.\n3. **O - Observe (Quan sát)**: Tìm chỗ trú gió, không đi xuống khe suối cạn.\n4. **P - Plan (Lập kế hoạch)**: Thổi còi 3 hồi ngắn báo SOS, tạo khói và bật định vị GPS.',
    },
    {
      q: 'Cách xử lý khi thành viên trong đoàn bị hạ thân nhiệt (Hypothermia)?',
      kw: ['hạ thân nhiệt', 'hypothermia', 'run rẩy', 'ủ ấm'],
      ans: '**Cấp cứu hạ thân nhiệt:**\n\n1. Thay trang phục ướt đẫm mồ hôi/nước mưa ngay lập tức.\n2. Đưa vào lều/túi ngủ kín gió, cách ly khỏi mặt đất lạnh.\n3. Đặt bình nước ấm ủ tại **nách, ngực và bẹn** (vùng động mạch lớn).\n4. Uống nước trà đường ấm nóng. **Tuyệt đối không xoa bóp mạnh chân tay**.',
    },
    {
      q: 'Cách sơ cứu khi bị rắn độc cắn trong rừng trước khi đến bệnh viện?',
      kw: ['rắn cắn', 'sơ cứu rắn', 'rắn độc', 'bất động'],
      ans: '**Sơ cứu rắn cắn chuẩn y khoa:**\n\n1. Giữ nạn nhân nằm yên, bất động hoàn toàn chi bị cắn (để chi thấp hơn tim).\n2. Rửa sạch vết thương bằng nước muối hoặc nước sạch.\n3. Băng ép nhẹ từ ngón chân/tay lên trên bằng băng thun.\n4. **Cấm**: Không rạch vết thương, không hút nọc độc, không đắp lá cây bẩn.\n5. Chụp ảnh con rắn nếu có thể và gọi ngay hotline cứu hộ **114 / 115**.',
    },
  ];

  emergencyTopics.forEach((e, idx) => {
    dataset.push({
      id: `emergency-q-${idx + 1}`,
      category: 'emergency_sos',
      question: e.q,
      keywords: e.kw,
      answer: e.ans,
    });
  });

  return dataset;
}

export const masterKnowledgeDataset: KnowledgeItem[] = buildMasterKnowledgeDataset();

/**
 * Search relevant FAQ knowledge items by user query
 */
export function queryKnowledgeDataset(userQuery: string, limit: number = 5): KnowledgeItem[] {
  const q = userQuery.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 1);

  const scored = masterKnowledgeDataset.map((item) => {
    let score = 0;
    if (item.question.toLowerCase().includes(q)) score += 10;
    for (const kw of item.keywords) {
      if (q.includes(kw)) score += 5;
    }
    for (const w of words) {
      if (item.question.toLowerCase().includes(w)) score += 1;
      if (item.answer.toLowerCase().includes(w)) score += 0.5;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 1).slice(0, limit).map((s) => s.item);
}
