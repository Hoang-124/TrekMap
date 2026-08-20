import { TrailModel } from '../models/Trail.js';
import { AiKnowledgeModel } from '../models/AiKnowledge.js';
import { mockTrails } from '../data/seedData.js';
import { queryKnowledgeDataset } from '../data/trekkerKnowledgeDataset.js';
import { Trail, AiAssistantAction } from '../types.js';



export interface ChatRequestPayload {
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userName?: string;
  userRole?: string;
  userReputation?: number;
  customApiKey?: string;
  currentTrailContext?: {
    trailId?: string;
    trailName?: string;
    province?: string;
    maxAltitudeM?: number;
    difficultyLevel?: number;
  };
  userCoordinates?: {
    lat: number;
    lng: number;
  };
}

export interface ChatResponsePayload {
  reply: string;
  actions?: AiAssistantAction[];
  modelUsed: 'gemini-live' | 'trekmap-knowledge-engine';
}

/**
 * Utility function to completely strip all emoji characters to enforce Pure SVG Iconography Mandate
 */
export function removeEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 100% Real Emergency Contacts Database in Vietnam Mountain Regions
export const REAL_EMERGENCY_CONTACTS = [
  {
    name: 'Cứu hộ Vườn Quốc Gia Hoàng Liên (Fansipan, Sa Pa)',
    phone: '02143.871.228',
    rangerContact: '114',
    region: 'Lào Cai - Lai Châu',
    address: 'Trạm kiểm lâm Trạm Tôn, Sa Pa, Lào Cai',
  },
  {
    name: 'Công an & Cứu nạn Xã Y Tý (Lảo Thẩn, Bát Xát)',
    phone: '02143.888.114',
    rangerContact: '02143.883.114',
    region: 'Bát Xát, Lào Cai',
    address: 'UBND Xã Y Tý, Huyện Bát Xát, Lào Cai',
  },
  {
    name: 'Hạt Kiểm Lâm Bắc Yên (Tà Xùa, Hang Chú)',
    phone: '02123.852.114',
    rangerContact: '114',
    region: 'Sơn La',
    address: 'Thị trấn Bắc Yên, Huyện Bắc Yên, Sơn La',
  },
  {
    name: 'Cứu hộ & Kiểm lâm Bát Xát (Kỳ Quan San, Nhìu Cồ San)',
    phone: '02143.883.114',
    rangerContact: '114',
    region: 'Lào Cai',
    address: 'Thị trấn Bát Xát, Huyện Bát Xát, Lào Cai',
  },
  {
    name: 'Cứu hộ Tà Năng - Phan Dũng (Đức Trọng / Tuy Phong)',
    phone: '02633.822.114',
    rangerContact: '02523.822.114',
    region: 'Lâm Đồng - Bình Thuận',
    address: 'Xã Tà Năng, Đức Trọng, Lâm Đồng & Phan Dũng, Tuy Phong, Bình Thuận',
  },
  {
    name: 'Trung tâm Cứu nạn Quốc gia (Khẩn cấp 24/7)',
    phone: '114',
    rangerContact: '115 (Y tế Cấp cứu) / 113 (Công an)',
    region: 'Toàn quốc',
    address: 'Cục Cứu hộ Cứu nạn Bộ Quốc Phòng & PCCC Toàn Quốc',
  },
];

// System Prompt for Live Gemini AI Model
const SYSTEM_INSTRUCTION = `Bạn là TrekCopilot AI - Trợ lý ảo thám hiểm & sinh tồn chuyên biệt cho cộng đồng leo núi (trekking) tại Việt Nam trên nền tảng TrekMap.

PHONG CÁCH GIAO TIẾP:
- Thân thiện, tôn trọng, xưng "em" hoặc "mình" và gọi người dùng bằng tên (nếu có trong ngữ cảnh) hoặc "anh/chị", "bạn trekker".
- Luôn chào hỏi lại niềm nở khi người dùng chào.
- Lắng nghe câu hỏi, trả lời đúng trọng tâm, cung cấp thông tin thực tế, không trả lời lan man hoặc cụt ngủn.
- Định dạng Markdown đẹp mắt (in đậm tiêu đề, gạch đầu dòng rõ ràng, số liệu chính xác).

QUY TẮC BẮT BUỘC VỀ TRÌNH BÀY & XUỐNG DÒNG DỄ ĐỌC (TUYỆT ĐỐI TUÂN THỦ):
- TUYỆT ĐỐI KHÔNG SỬ DỤNG BẤT KỲ BIỂU TƯỢNG EMOJI NÀO TRONG PHẢN HỒI (Hệ thống TrekMap chỉ dùng Vector SVG thuần túy).
- TUYỆT ĐỐI KHÔNG VIẾT MỘT ĐOẠN VĂN DÀI DÍNH LIỀN (CẤM WALL OF TEXT). Người dùng cần đọc lướt nhanh chóng.
- BẮT BUỘC XUỐNG DÒNG RÕ RÀNG (hai dấu xuống dòng \n\n) giữa các phần:
  1. Câu chào đầu dòng ngắn gọn (1-2 câu).
  2. Mỗi mục thông tin (1., 2., 3. hoặc các gạch đầu dòng -) PHẢI là một dòng/đoạn riêng biệt, có khoảng cách thoáng đãng.
  3. Câu kết và gợi ý hành động ở cuối đoạn riêng.
- TUYỆT ĐỐI KHÔNG ĐẶT CÁC TỪ TIÊU ĐIỂM HOẶC THUẬT NGỮ TRONG DẤU NGOẶC KÉP dạng ""từ nào đó"" hay "từ nào đó".
- HÃY LÀM NỔI BẬT CÁC TỪ TIÊU ĐIỂM (tên địa danh, đỉnh núi, quy tắc an toàn, thuật ngữ kỹ thuật) bằng cú pháp in đậm Markdown: **từ tiêu điểm** (Ví dụ: **Lảo Thẩn**, **Quy tắc 3 lớp áo**, **Sốc độ cao AMS**, **S.T.O.P**).



NGUYÊN TẮC BẮT BUỘC VỀ DỮ LIỆU & AN TOÀN:
1. DỮ LIỆU THẬT 100%: Mọi độ cao đỉnh núi, khoảng cách, tọa độ GPS, trạm kiểm lâm, ban quản lý vườn quốc gia và số điện thoại hotline cứu hộ phải chính xác 100% theo thực tế địa lý Việt Nam. Tuyệt đối không bịa đặt số liệu.
   - Fansipan: 3.143m (Lào Cai - Lai Châu, VQG Hoàng Liên)
   - Lảo Thẩn: 2.860m (Y Tý, Bát Xát, Lào Cai)
   - Tà Xùa: 2.865m (Bắc Yên, Sơn La - Trạm Tấu, Yên Bái)
   - Bạch Mộc Lương Tử / Kỳ Quan San: 3.046m (Bát Xát, Lào Cai / Phong Thổ, Lai Châu)
   - Tà Năng - Phan Dũng: Cung trekking 55km nối Lâm Đồng sang Bình Thuận
   - Núi Chứa Chan: 837m (Đồng Nai)
   - Núi Bà Đen: 986m (Tây Ninh)
   - Núi Dinh: 504m (Bà Rịa - Vũng Tàu)
   - Bidoup Núi Bà: 2.287m (Lạc Dương, Lâm Đồng)

2. CỨU HỘ & AN TOÀN SINH TỒN:
   - Khi người dùng gặp nguy cấp (lạc đường, sốc độ cao AMS, hạ thân nhiệt, chấn thương, lũ quét, rắn cắn), luôn đưa ra hướng dẫn sơ cấp cứu theo chuẩn y tế dã ngoại trước tiên và cung cấp ngay số cứu hộ thực tế.
   - Lạc đường: Dừng lại (S.T.O.P), giữ nguyên vị trí, không đi bừa xuống vực/khe suối cạn dễ gặp thác cụt, phát tín hiệu còi 3 hồi ngắn hoặc tạo khói.
   - Sốc độ cao (AMS): Giảm độ cao ngay lập tức, giữ ấm, uống nước oresol, không gắng sức.
   - Hạ thân nhiệt: Thay đồ khô ngay lập tức, cách ly khỏi mặt đất lạnh, uống nước ấm có đường, ủ ấm ngực/nách/bẹn.`;

// In-memory local cache for instant zero-latency trail lookups
let cachedTrails: Trail[] = mockTrails;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes


/**
 * Fetch all available trails with In-Memory Local Caching (0ms latency)
 */
async function getAllAvailableTrails(): Promise<Trail[]> {
  const now = Date.now();
  if (cachedTrails.length > 0 && now - lastCacheTimestamp < CACHE_TTL_MS) {
    return cachedTrails;
  }

  try {
    const dbPromise = TrailModel.find({ status: 'approved' }).lean().maxTimeMS(1500);
    const dbTrails = await Promise.race([
      dbPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
    ]);

    if (dbTrails && Array.isArray(dbTrails) && dbTrails.length > 0) {
      cachedTrails = dbTrails.map((t: any) => ({
        id: t._id ? String(t._id) : t.id,
        name: t.name,
        altNames: t.altNames || [],
        region: t.region,
        province: t.province,
        district: t.district,
        startLat: t.startLat,
        startLng: t.startLng,
        endLat: t.endLat,
        endLng: t.endLng,
        distanceKm: t.distanceKm,
        elevationGainM: t.elevationGainM,
        maxAltitudeM: t.maxAltitudeM,
        durationDays: t.durationDays,
        durationHoursNote: t.durationHoursNote,
        difficultyLevel: t.difficultyLevel,
        difficultyNote: t.difficultyNote,
        bestMonths: t.bestMonths || [],
        avoidMonths: t.avoidMonths || [],
        gpxTrack: t.gpxTrack || [],
        waypoints: t.waypoints || [],
        description: t.description,
        transportationInfo: t.transportationInfo,
        permitRequired: t.permitRequired,
        permitInfo: t.permitInfo,
        rescueContact: t.rescueContact || { name: 'Cứu hộ VQG Hoàng Liên', phone: '02143.871.228', rangerContact: '114' },
        coverImage: t.coverImage,
        galleryImages: t.galleryImages || [],
        hasCampsite: t.hasCampsite,
        hasWaterSource: t.hasWaterSource,
        kidFriendly: t.kidFriendly,
        rating: t.rating || 0,
        reviewCount: t.reviewCount || 0,
        status: t.status,
        createdAt: t.createdAt ? String(t.createdAt) : new Date().toISOString(),
        updatedAt: t.updatedAt ? String(t.updatedAt) : new Date().toISOString(),
      }));
      lastCacheTimestamp = now;
      return cachedTrails;
    }
  } catch (err) {
    // Fallback instantly
  }

  cachedTrails = mockTrails;
  lastCacheTimestamp = now;
  return cachedTrails;
}

/**
 * Call Live Google Gemini API with AbortSignal timeout and instant fallback
 */
async function generateWithGemini(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  contextData: string = '',
  customApiKey?: string
): Promise<string | null> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
    let lastError = null;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `${SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU HIỆN CÓ CỦA TREKMAP]:\n${contextData}`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: 'Dạ, em đã nắm rõ toàn bộ cơ sở dữ liệu thực địa, nguyên tắc cứu hộ an toàn và quy định tuyệt đối không dùng emoji của TrekMap. Em đã sẵn sàng hỗ trợ các trekker chu đáo và chuyên nghiệp nhất bằng văn bản chuẩn mực!',
          },
        ],
      },
      ...history.slice(-6).map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: removeEmojis(h.content) }],
      })),
      {
        role: 'user',
        parts: [{ text: removeEmojis(prompt) }],
      },
    ];

    for (const modelName of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(6500),
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.35,
              topP: 0.85,
              maxOutputTokens: 8192,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            return removeEmojis(candidate.trim());
          }
        } else {
          lastError = `${response.status} ${response.statusText}`;
        }
      } catch (innerErr) {
        lastError = innerErr;
      }
    }

    if (lastError) {
      console.warn('[TrekCopilot AI] Gemini models failed, falling back to Knowledge Engine:', lastError);
    }
    return null;
  } catch (error) {
    console.warn('[TrekCopilot AI] Gemini call failed, gracefully falling back to Knowledge Engine:', error);
    return null;
  }
}


/**
 * Intelligent Real Knowledge Engine (Offline-Ready / Zero-Latency Fallback)
 */
function processWithKnowledgeEngine(
  rawQuery: string,
  trails: Trail[],
  currentTrailContext?: ChatRequestPayload['currentTrailContext'],
  userName?: string
): { reply: string; actions: AiAssistantAction[] } {
  const query = removeEmojis(rawQuery).toLowerCase().trim();
  const actions: AiAssistantAction[] = [];
  const displayName = userName ? userName.replace(/\s*\(.*?\)/, '').trim() : '';

  // 1. GREETINGS & PERSONALITY & ABOUT
  const isGreeting =
    query === 'chào' ||
    query === 'hi' ||
    query === 'hello' ||
    query === 'xin chào' ||
    query === 'alo' ||
    query === 'hey' ||
    query.startsWith('chào ') ||
    query.startsWith('xin chào') ||
    query.includes('chào bạn') ||
    query.includes('chào em') ||
    query.includes('chào admin') ||
    query.includes('bạn là ai') ||
    query.includes('bạn tên gì') ||
    query.includes('ai tạo ra bạn') ||
    query.includes('bạn giúp được gì');

  if (isGreeting) {
    const greetingName = displayName ? `**${displayName}**` : 'bạn';
    const reply = `**Chào ${greetingName}!** Rất vui được gặp bạn trên TrekMap.

Em là **TrekCopilot AI** — trợ lý thám hiểm & sinh tồn chuyên biệt cho địa hình leo núi tại Việt Nam.

Em có thể giúp bạn giải quyết các vấn đề sau:
1. **Tư vấn cung đường theo thể lực**: Săn mây Lảo Thẩn, Tà Xùa; chinh phục Nóc nhà Fansipan; ngắm hoa tím Tà Chì Nhù; hay thử thách thảo nguyên Tà Năng - Phan Dũng.
2. **Cứu hộ khẩn cấp & Sơ cấp cứu**: Hướng dẫn xử lý sốc độ cao (AMS), lạc đường, hạ thân nhiệt & cung cấp hotline kiểm lâm thực tế.
3. **Lập checklist balo & Quản lý trọng lượng**: Tính toán đồ cần mang theo quy tắc 3 lớp áo, kiểm soát balo dưới 20% thể trọng.
4. **Dự báo thời tiết & Mùa leo núi đẹp nhất** từng vùng miền.
5. **Kết nối Porter/Guide uy tín** tại địa phương.

*Hôm nay bạn đang có kế hoạch đi cung đường nào, hoặc cần em hỗ trợ điều gì không ạ?*`;

    actions.push({
      type: 'quick_reply',
      suggestions: [
        'Gợi ý cung săn mây cho người mới',
        'Cấp cứu khẩn cấp: Sốc độ cao & Lạc đường',
        'Checklist đồ leo núi 2N1Đ',
        'Hotline cứu hộ Sa Pa / Y Tý',
        'Kế hoạch tập thể lực 4 tuần trước khi leo núi',
      ],
    });

    return { reply: removeEmojis(reply), actions };
  }

  // 2. GRATITUDE & FAREWELL
  if (query.includes('cảm ơn') || query.includes('thank') || query.includes('tuyệt vời') || query.includes('ok em') || query.includes('tạm biệt') || query.includes('bye')) {
    const reply = `Dạ không có gì ạ! Chúc ${displayName ? displayName : 'bạn'} luôn có những chuyến đi an toàn, chân cứng đá mềm và chinh phục được nhiều đỉnh núi hùng vĩ của Việt Nam!

Nếu cần hỗ trợ bất kỳ lúc nào trên hành trình, hãy cứ mở TrekCopilot AI lên nhé!`;
    return { reply: removeEmojis(reply), actions };
  }

  // 3. FITNESS PREPARATION (Tập thể lực)
  if (query.includes('thể lực') || query.includes('tập luyện') || query.includes('chạy bộ') || query.includes('chuẩn bị thể lực') || query.includes('chuột rút')) {
    const reply = `**KẾ HOẠCH TẬP THỂ LỰC CHUẨN BỊ LEO NÚI (LỘ TRÌNH 4 TUẦN):**

Leo núi vùng cao đòi hỏi sức bền tim mạch (Cardio) và sức mạnh cơ đùi, bắp chân, khớp gối:

**Tuần 1 & 2: Xây dựng nền tảng tim mạch**
- **Chạy bộ / Đi bộ dốc**: 3-4 buổi/tuần, mỗi buổi 3-5km với tốc độ vừa phải.
- **Leo cầu thang**: Leo bộ 15-20 tầng/ngày (hạn chế đi thang máy), chỉ bước lên, đi thang máy xuống để bảo vệ khớp gối.

**Tuần 3: Tăng tải trọng thực tế (Balo)**
- **Leo cầu thang vác tải**: Đeo balo nặng **4kg - 6kg** (cho 2-3 chai nước vào balo) và leo 25-30 tầng.
- **Bài tập bổ trợ (Leg Strength)**:
  - *Squats*: 3 hiệp x 15 lần (tăng cơ đùi trước).
  - *Lunges (chùng chân)*: 3 hiệp x 12 lần mỗi chân (tăng thăng bằng và cơ mông).
  - *Plank*: 3 hiệp x 45-60 giây (tăng cơ core giữ thăng bằng khi vác balo nặng).

**Tuần 4: Giảm tải & Dưỡng sức (Tapering)**
- Giảm cường độ tập luyện trước ngày đi 4-5 ngày để cơ bắp hồi phục.
- Ngủ đủ 7-8 tiếng/ngày, bổ sung Magie và Kali (chuối, nước dừa) để chống chuột rút.

*Mẹo thực địa*: Mang theo **Gậy trekking** sẽ giúp giảm 25% lực đè nén lên đầu gối khi xuống dốc!`;

    actions.push({
      type: 'quick_reply',
      suggestions: ['Checklist trang bị Balo 2N1Đ', 'Tư vấn giày trekking phù hợp', 'Xử lý sốc độ cao (AMS)'],
    });

    return { reply: removeEmojis(reply), actions };
  }

  // 4. FOOD, COOKING & HYDRATION (Ăn uống & Dinh dưỡng đi rừng)
  if (query.includes('ăn') || query.includes('nấu') || query.includes('thực phẩm') || query.includes('uống') || query.includes('dinh dưỡng') || query.includes('nước')) {
    const reply = `**CHẾ ĐỘ DINH DƯỠNG & NƯỚC UỐNG TRÊN ĐƯỜNG TREKKING:**

**1. Quy tắc bù nước & điện giải**:
- **Cơ chế uống**: Uống từng ngụm nhỏ cách nhau **15 - 20 phút** (không đợi khát mới uống, không uống ừng ực làm loãng máu và nặng bụng).
- **Dung tích cần mang**: Tối thiểu **2 - 2.5 lít nước/ngày**.
- **Điện giải**: Pha 1 gói **Oresol** hoặc viên sủi điện giải vào bình nước để bù lượng muối khoáng mất qua mồ hôi, ngăn ngừa chuột rút và sốc nhiệt.

**2. Thực phẩm nạp năng lượng nhanh (Snacks di chuyển)**:
- **Lương khô quân đội (Kayon/BB784)**: Nhỏ gọn, no lâu, không sợ hư hỏng.
- **Gel năng lượng (Energy Gel) / Kẹo dẻo thể thao**: Hấp thụ nhanh sau 5 phút khi gặp dốc gắt.
- **Hạt dinh dưỡng (Hạnh nhân, óc chó, nho khô)**: Cung cấp chất béo tốt và năng lượng bền bỉ.
- **Socola đen**: Giúp tăng hưng phấn và giữ ấm tức thì.

**3. Bữa ăn chính tại lán đêm**:
- Thịt lợn bản nướng/xào gừng, gà đồi luộc, canh rau rừng nóng hổi (thường do Porter chuẩn bị).
- Cơm nóng nhiều tinh bột để bù đắp glycogen cho cơ bắp phục hồi qua đêm.`;

    actions.push({
      type: 'quick_reply',
      suggestions: ['Quy tắc xếp balo 3 tầng', 'Checklist đồ leo núi', 'Cứu hộ khẩn cấp'],
    });

    return { reply: removeEmojis(reply), actions };
  }

  // 5. BUDGET & PORTER COSTS (Chi phí & Giá thuê Porter)
  if (query.includes('chi phí') || query.includes('giá') || query.includes('bao nhiêu tiền') || query.includes('ngân sách') || query.includes('porter')) {
    const reply = `**DỰ TOÁN CHI PHÍ CHO 1 CHUYẾN TREKKING TỰ TÚC (2N1Đ - 3N2Đ):**

Dưới đây là mức chi phí thực tế trung bình tại các cung Tây Bắc (Fansipan, Lảo Thẩn, Tà Xùa, Kỳ Quan San):

1. **Di chuyển (Xe khách giường nằm khứ hồi Hà Nội - Lào Cai/Sa Pa/Sơn La)**:
   - Khoảng **500.000 - 700.000 VNĐ** / người.
2. **Thuê Porter / Hướng dẫn viên bản địa**:
   - Khoảng **500.000 - 700.000 VNĐ / ngày** (1 Porter thường vác tối đa 12 - 15kg đồ chung + chuẩn bị bữa ăn lán).
   - *Gợi ý*: Nhóm 3-4 người nên thuê chung 1 Porter (chia ra chỉ khoảng 300k-400k/người).
3. **Vé tham quan & Giấy phép Vườn Quốc Gia / Kiểm lâm**:
   - VQG Hoàng Liên: ~**150.000 - 250.000 VNĐ** / người.
   - Các cung tự do (Lảo Thẩn, Tà Xùa, Tà Chì Nhù): Miễn phí hoặc lệ phí gửi xe bản 50k.
4. **Phí ngủ lán gỗ / Bãi cắm trại**:
   - Khoảng **100.000 - 150.000 VNĐ** / đêm (bao gồm chăn ấm và chỗ ngủ có mái che).
5. **Thực phẩm & Nước uống**:
   - Khoảng **400.000 - 600.000 VNĐ** / người.

**TỔNG CHI PHÍ DỰ KIẾN**: Từ **1.800.000 - 2.800.000 VNĐ / người** cho hành trình 2N1Đ trọn vẹn và an toàn!`;

    actions.push({
      type: 'quick_reply',
      suggestions: ['Hotline Porter Y Tý & Sa Pa', 'Checklist balo leo núi', 'Gợi ý cung cho người mới'],
    });

    return { reply: removeEmojis(reply), actions };
  }

  // 6. EMERGENCY SOS & RESCUE QUERIES
  const isEmergency =
    query.includes('cứu hộ') ||
    query.includes('khẩn cấp') ||
    query.includes('lạc đường') ||
    query.includes('sốc độ cao') ||
    query.includes('ams') ||
    query.includes('hạ thân nhiệt') ||
    query.includes('rắn cắn') ||
    query.includes('tai nạn') ||
    query.includes('gãy xương') ||
    query.includes('lũ quét') ||
    query.includes('sos');

  if (isEmergency) {
    let matchedContacts = REAL_EMERGENCY_CONTACTS;
    if (query.includes('fansipan') || query.includes('sa pa') || query.includes('hoàng liên')) {
      matchedContacts = [REAL_EMERGENCY_CONTACTS[0], REAL_EMERGENCY_CONTACTS[5]];
    } else if (query.includes('lảo thẩn') || query.includes('y tý') || query.includes('kỳ quan san') || query.includes('bạch mộc')) {
      matchedContacts = [REAL_EMERGENCY_CONTACTS[1], REAL_EMERGENCY_CONTACTS[3], REAL_EMERGENCY_CONTACTS[5]];
    } else if (query.includes('tà xùa') || query.includes('bắc yên')) {
      matchedContacts = [REAL_EMERGENCY_CONTACTS[2], REAL_EMERGENCY_CONTACTS[5]];
    } else if (query.includes('tà năng') || query.includes('phan dũng') || query.includes('lâm đồng') || query.includes('bình thuận')) {
      matchedContacts = [REAL_EMERGENCY_CONTACTS[4], REAL_EMERGENCY_CONTACTS[5]];
    }

    actions.push({
      type: 'emergency_sos',
      emergencyContacts: matchedContacts,
      suggestions: ['Hotline cứu hộ Sa Pa / Fansipan', 'Xử lý sốc độ cao (AMS)', 'Cách phát tín hiệu khi lạc đường'],
    });

    let emergencyAdvice = `**GIAO THỨC CỨU HỘ & XỬ LÝ KHẨN CẤP TRÊN NÚI**\n\n`;

    if (query.includes('sốc độ cao') || query.includes('ams')) {
      emergencyAdvice += `**XỬ LÝ SỐC ĐỘ CAO (AMS - Acute Mountain Sickness):**
1. **Hạ cao độ NGAY LẬP TỨC**: Di chuyển xuống vị trí thấp hơn ít nhất 300m - 500m. Đây là biện pháp duy nhất giúp hồi phục tuần hoàn oxy.
2. **Nghỉ ngơi & Bù nước**: Uống từng ngụm nhỏ nước ấm pha Oresol hoặc gừng ấm. Tuyệt đối không gắng sức leo tiếp.
3. **Thở sâu**: Thở nhịp nhàng bằng mũi, thở ra bằng miệng để tăng dung tích phổi.
4. **Nếu có triệu chứng nặng** (nôn mửa dữ dội, lú lẫn, thở khò khè phù phổi): Kích hoạt ngay đội cứu hộ và đưa xuống chân núi.`;
    } else if (query.includes('lạc đường')) {
      emergencyAdvice += `**XỬ LÝ KHI BỊ LẠC ĐƯỜNG / MẤT DẤU TRACKLOG (Quy tắc S.T.O.P):**
1. **S - Stop (Dừng lại)**: Bình tĩnh, dừng bước ngay lập tức. Không hoảng loạn đi tiếp khiến càng lạc sâu.
2. **T - Think (Suy nghĩ)**: Xác định lần cuối bạn nhìn thấy mốc đường/bản chỉ dẫn là ở đâu.
3. **O - Observe (Quan sát)**: Nhìn địa hình, tìm sóng điện thoại ở mỏm đá cao. **Tuyệt đối không đi dọc khe suối cạn** vì dễ gặp vực thác dựng đứng không có lối quay lại.
4. **P - Plan (Lập kế hoạch)**: Tìm chỗ trú gió, đốt lửa tạo khói báo hiệu (ban ngày) hoặc bật đèn pin nhấp nháy / thổi còi 3 hồi ngắn liên tục (tín hiệu SOS quốc tế).`;
    } else if (query.includes('hạ thân nhiệt')) {
      emergencyAdvice += `**XỬ LÝ HẠ THÂN NHIỆT (Hypothermia):**
1. **Thay đồ khô ngay**: Cởi bỏ trang phục ướt đẫm mồ hôi/nước mưa.
2. **Cách ly với nền đất lạnh**: Trải thảm cách nhiệt, chui vào túi ngủ hoặc lều kín gió.
3. **Ủ ấm trung tâm**: Dùng bình nước ấm hoặc miếng dán nhiệt đặt ở nách, ngực và bẹn. Uống nước trà đường ấm nóng. Tuyệt đối không xoa bóp mạnh tay chân vì làm máu lạnh dồn về tim.`;
    } else {
      emergencyAdvice += `**HƯỚNG DẪN ỨNG PHÓ KHẨN CẤP:**
- **Gọi cứu hộ ngay**: Sử dụng danh bạ hotline bên dưới để liên hệ Kiểm lâm / Công an xã gần nhất.
- **Định vị GPS**: Bật tính năng định vị trên điện thoại để đọc tọa độ (Kinh độ/Vĩ độ) cho đội cứu hộ.
- **Bảo toàn năng lượng**: Giữ ấm cơ thể, gom các thành viên lại gần nhau, chia khẩu phần nước uống và lương khô.`;
    }

    return { reply: removeEmojis(emergencyAdvice), actions };
  }

  // 7. GEAR CHECKLIST & PACKING ADVICE
  const isGearQuery =
    query.includes('đồ') ||
    query.includes('balo') ||
    query.includes('trang bị') ||
    query.includes('chuẩn bị') ||
    query.includes('checklist') ||
    query.includes('mang theo');

  if (isGearQuery) {
    const gearList = [
      {
        category: 'Trang phục & Giữ nhiệt (Quy tắc 3 lớp)',
        items: [
          'Áo thun thể thao thoát mồ hôi (Base Layer) x2',
          'Áo nỉ giữ nhiệt hoặc áo lông vũ siêu nhẹ (Mid Layer)',
          'Áo gió chống thấm nước GORE-TEX (Outer Layer)',
          'Quần trekking co giãn nhanh khô + Tất len merino chống phồng rộp (2-3 đôi)',
          'Khăn rằn / Buff chống nắng + Găng tay leo núi có độ bám',
        ],
      },
      {
        category: 'Trang bị Di chuyển & Sinh tồn',
        items: [
          'Giày trekking đế gai bám đá chuyên dụng (đã break-in)',
          'Gậy trekking (giảm 25% áp lực lên đầu gối khi xuống dốc)',
          'Đèn pin đội đầu (Headlamp) + Pin dự phòng',
          'Bình/Túi nước dung tích 2 - 3 Lít + Viên lọc nước/Oresol',
          'Áo mưa bộ / Áo mưa trùm balo chống ướt',
          'Bật lửa sinh tồn + Còi cứu hộ SOS',
        ],
      },
      {
        category: 'Y tế Dã ngoại & Dinh dưỡng',
        items: [
          'Bộ sơ cứu cá nhân (Băng gạc cá nhân, gạc tiệt trùng, Povidine sát trùng)',
          'Thuốc hạ sốt Paracetamol, Berberin đau bụng, Men vi sinh',
          'Thuốc xịt chống muỗi/kem chống vắt (DEET), Miếng dán giữ nhiệt',
          'Thực phẩm bổ sung: Lương khô quân đội, Gel năng lượng, Socola, Hạt dinh dưỡng',
        ],
      },
    ];

    actions.push({
      type: 'gear_checklist',
      checklistItems: gearList,
      suggestions: ['Quy tắc phân bổ trọng lượng balo 3 tầng', 'Tư vấn giày trekking phù hợp', 'Checklist Fansipan 2N1Đ'],
    });

    const reply = `**CHECKLIST TRANG BỊ LEO NÚI CHUẨN DÃ NGOẠI VIỆT NAM**

Một hành trình trekking an toàn bắt đầu từ chiếc balo chuẩn bị kỹ lưỡng:

**Quy tắc trọng lượng**: Tổng trọng lượng balo chỉ nên chiếm tối đa **18% - 20% trọng lượng cơ thể** (Ví dụ: bạn nặng 60kg thì balo chỉ nên từ 10kg - 12kg).

**Quy tắc xếp đồ 3 tầng**:
- **Đáy balo**: Đồ nhẹ, ít dùng trên đường (Túi ngủ, đồ ngủ dự phòng).
- **Giữa balo (sát lưng)**: Đồ nặng nhất (Nước, đồ ăn, đồ cắm trại) để dồn trọng tâm vào hông.
- **Đỉnh balo & Ngăn ngoài**: Đồ cần lấy nhanh (Áo mưa, đèn pin, hộp y tế sơ cứu, đồ ăn nhẹ).

*Bạn có thể xem chi tiết danh mục trang bị bên dưới để kiểm tra từng món nhé!*`;

    return { reply: removeEmojis(reply), actions };
  }

  // 8. TRAIL RECOMMENDATION BY DIFFICULTY / OBJECTIVE / REGION
  const isBeginner = query.includes('mới') || query.includes('beginner') || query.includes('dễ') || query.includes('nhẹ nhàng') || query.includes('trẻ em');
  const isCloudHunting = query.includes('săn mây') || query.includes('biển mây') || query.includes('mây');
  const isHardcore = query.includes('khó') || query.includes('thử thách') || query.includes('hardcore') || query.includes('dài ngày') || query.includes('3 ngày');
  const isSouth = query.includes('miền nam') || query.includes('sài gòn') || query.includes('tây ninh') || query.includes('đồng nai') || query.includes('vũng tàu');
  const isFlower = query.includes('hoa') || query.includes('chi pâu') || query.includes('đỗ quyên');

  let recommendedTrails: Trail[] = [];

  if (isCloudHunting) {
    recommendedTrails = trails.filter((t) => t.name.includes('Lảo Thẩn') || t.name.includes('Tà Xùa') || t.name.includes('Kỳ Quan San'));
  } else if (isBeginner) {
    recommendedTrails = trails.filter((t) => t.difficultyLevel <= 3);
  } else if (isHardcore) {
    recommendedTrails = trails.filter((t) => t.difficultyLevel >= 4);
  } else if (isSouth) {
    recommendedTrails = trails.filter((t) => t.region === 'Miền Nam');
  } else if (isFlower) {
    recommendedTrails = trails.filter((t) => t.name.includes('Tà Chì Nhù') || t.name.includes('Fansipan'));
  } else {
    // Search by specific trail name mentioned
    recommendedTrails = trails.filter((t) => {
      const matchName = query.includes(t.name.toLowerCase());
      const matchAlt = t.altNames?.some((alt) => query.includes(alt.toLowerCase()));
      const matchProv = query.includes(t.province.toLowerCase());
      return matchName || matchAlt || matchProv;
    });
  }

  if (recommendedTrails.length === 0) {
    recommendedTrails = trails.slice(0, 3);
  }

  // Add trail card actions
  for (const trail of recommendedTrails.slice(0, 2)) {
    actions.push({
      type: 'trail_card',
      trailId: trail.id,
      trailName: trail.name,
      trailData: {
        id: trail.id,
        name: trail.name,
        province: trail.province,
        region: trail.region,
        distanceKm: trail.distanceKm,
        elevationGainM: trail.elevationGainM,
        maxAltitudeM: trail.maxAltitudeM,
        difficultyLevel: trail.difficultyLevel,
        difficultyNote: trail.difficultyNote,
        durationHoursNote: trail.durationHoursNote,
        coverImage: trail.coverImage,
      },
    });
  }

  let trailAdvice = `**GỢI Ý CUNG ĐƯỜNG THỰC ĐỊA PHÙ HỢP:**\n\n`;

  recommendedTrails.slice(0, 3).forEach((t, index) => {
    trailAdvice += `**${index + 1}. ${t.name}**\n`;
    trailAdvice += `- **Địa điểm**: ${t.district ? t.district + ', ' : ''}${t.province} (${t.region})\n`;
    trailAdvice += `- **Độ cao đỉnh**: **${t.maxAltitudeM.toLocaleString()}m** | Độ dốc tích lũy: +${t.elevationGainM}m\n`;
    trailAdvice += `- **Cự ly & Thời gian**: ${t.distanceKm}km (${t.durationHoursNote})\n`;
    trailAdvice += `- **Độ khó**: Cấp độ ${t.difficultyLevel}/5 (${t.difficultyNote || 'Tiêu chuẩn'})\n`;
    trailAdvice += `- **Mùa đẹp nhất**: Tháng ${t.bestMonths?.join(', ') || '10 - 4'}\n\n`;
  });

  trailAdvice += `*Mẹo*: Bạn có thể nhấn vào thẻ cung đường bên dưới để xem trực quan bản đồ 3D địa hình và tải tracklog GPX!`;

  return { reply: removeEmojis(trailAdvice), actions };
}

/**
 * Search Master Knowledge directly from MongoDB Database (with text index score)
 */
async function searchDatabaseKnowledge(userQuery: string, limit: number = 3): Promise<Array<{ question: string; answer: string }>> {
  try {
    const cleanQ = removeEmojis(userQuery).trim();
    if (!cleanQ) return [];

    const dbResults = await AiKnowledgeModel.find(
      { $text: { $search: cleanQ }, isActive: true },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean()
      .maxTimeMS(800);

    if (dbResults && dbResults.length > 0) {
      return dbResults.map((r: any) => ({ question: r.question, answer: r.answer }));
    }
  } catch (err) {
    // Fallback to in-memory dataset
  }

  return queryKnowledgeDataset(userQuery, limit).map((r) => ({ question: r.question, answer: r.answer }));
}

/**
 * Main Controller Handler for AI Chat
 */

export async function getAiResponse(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  const { message, conversationHistory = [], currentTrailContext, userCoordinates, userName, customApiKey } = payload;
  const availableTrails = await getAllAvailableTrails();

  // Prepare database context for Gemini
  let contextSnippet = `DANH SÁCH CUNG ĐƯỜNG THẬT TRÊN HỆ THỐNG TREKMAP:\n`;
  for (const t of availableTrails) {
    contextSnippet += `- [ID: ${t.id}] ${t.name} (Tỉnh: ${t.province}, Vùng: ${t.region}, Cao độ: ${t.maxAltitudeM}m, Dài: ${t.distanceKm}km, Dốc: +${t.elevationGainM}m, Độ khó: ${t.difficultyLevel}/5, Tháng đẹp: ${t.bestMonths?.join(', ')}, Giấy phép: ${t.permitRequired ? 'Cần xin phép' : 'Tự do'}, Hotline cứu hộ: ${t.rescueContact?.phone || '114'}). Mô tả: ${t.description.slice(0, 150)}...\n`;
  }

  if (userName) {
    contextSnippet += `\nTÊN NGƯỜI DÙNG ĐANG TRÒ CHUYỆN: ${userName}\n`;
  }

  if (currentTrailContext?.trailName) {
    contextSnippet += `\nNGƯỜI DÙNG HIỆN ĐANG XEM TRANG CUNG ĐƯỜNG: ${currentTrailContext.trailName} (Tỉnh: ${currentTrailContext.province || ''}, Độ cao: ${currentTrailContext.maxAltitudeM || ''}m)\n`;
  }

  if (userCoordinates) {
    contextSnippet += `TỌA ĐỘ GPS NGƯỜI DÙNG: Lat ${userCoordinates.lat}, Lng ${userCoordinates.lng}\n`;
  }

  // Retrieve relevant Q&A from MongoDB Database or Knowledge Base (Fast Index RAG Grounding)
  const matchedFaqs = await searchDatabaseKnowledge(message, 3);
  if (matchedFaqs.length > 0) {
    contextSnippet += `\nTRI THỨC THỰC ĐỊA & CÂU TRẢ LỜI CHUẨN XÁC LIÊN QUAN:\n`;
    for (const faq of matchedFaqs) {
      contextSnippet += `[CÂU HỎI]: ${faq.question}\n[THÔNG TIN CHUẨN]: ${faq.answer}\n\n`;
    }
  }

  // 1. Attempt Live Gemini Generation
  const geminiText = await generateWithGemini(message, conversationHistory, contextSnippet, customApiKey);



  if (geminiText) {
    const cleanGemini = removeEmojis(geminiText);
    // Detect actions from response and query
    const { actions } = processWithKnowledgeEngine(message + ' ' + cleanGemini, availableTrails, currentTrailContext, userName);
    return {
      reply: cleanGemini,
      actions,
      modelUsed: 'gemini-live',
    };
  }

  // 2. Knowledge Engine Intelligent Fallback
  const { reply, actions } = processWithKnowledgeEngine(message, availableTrails, currentTrailContext, userName);
  return {
    reply: removeEmojis(reply),
    actions,
    modelUsed: 'trekmap-knowledge-engine',
  };
}

/**
 * Get Contextual Quick Prompts
 */
export function getContextualQuickPrompts(currentTrail?: { name?: string; province?: string }): string[] {
  if (currentTrail?.name) {
    return [
      `Kinh nghiệm & lịch trình leo ${currentTrail.name}`,
      `Thời tiết và mùa đẹp nhất leo ${currentTrail.name}`,
      `Checklist balo & trang bị cho ${currentTrail.name}`,
      `Hotline cứu hộ & Porter dẫn đường tại ${currentTrail.province || currentTrail.name}`,
      `Chi phí dự kiến và thủ tục xin giấy phép tại ${currentTrail.name}`,
    ];
  }

  return [
    'Xin chào TrekCopilot AI!',
    'Gợi ý cung săn mây đẹp cho người mới bắt đầu',
    'Kế hoạch tập thể lực 4 tuần trước khi leo núi',
    'Checklist đồ dùng sinh tồn & Balo leo núi 2N1Đ',
    'Dự toán chi phí & thuê Porter dẫn đường',
    'Cấp cứu khẩn cấp: Sốc độ cao (AMS) & Lạc đường',
  ];
}
