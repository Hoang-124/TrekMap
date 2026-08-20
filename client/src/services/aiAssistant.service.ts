import { mockTrails } from '../data/seedData.js';
import type { AiAssistantAction } from '../types.js';

const API_BASE = '/api/ai';

export interface ChatPayload {
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userName?: string;
  userRole?: string;
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

export interface ChatResponse {
  reply: string;
  actions?: AiAssistantAction[];
  modelUsed: 'gemini-live' | 'trekmap-knowledge-engine';
}

/**
 * Utility function to strip all emojis to comply with Pure SVG mandate
 */
export function removeEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Client-side Fallback Emergency Contacts
const FALLBACK_EMERGENCY_CONTACTS = [
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
    name: 'Cứu nạn Cứu hộ Toàn quốc',
    phone: '114',
    rangerContact: '115 (Cấp cứu) / 113 (Công an)',
    region: 'Toàn quốc',
    address: '24/7 Miễn phí trên mọi mạng di động',
  },
];

/**
 * Fallback response generator if network or backend fails
 */
function generateLocalFallback(
  query: string,
  _currentTrail?: ChatPayload['currentTrailContext'],
  userName?: string
): ChatResponse {
  const q = removeEmojis(query).toLowerCase().trim();
  const actions: AiAssistantAction[] = [];
  const displayName = userName ? userName.replace(/\s*\(.*?\)/, '').trim() : '';

  // 1. GREETING & PERSONA
  const isGreeting =
    q === 'chào' ||
    q === 'hi' ||
    q === 'hello' ||
    q === 'xin chào' ||
    q === 'alo' ||
    q.startsWith('chào ') ||
    q.startsWith('xin chào') ||
    q.includes('chào bạn') ||
    q.includes('chào em') ||
    q.includes('bạn là ai') ||
    q.includes('bạn tên gì');

  if (isGreeting) {
    const greetingName = displayName ? `**${displayName}**` : 'bạn';
    return {
      reply: `**Chào ${greetingName}!** Rất vui được đồng hành cùng bạn trên TrekMap.

Em là **TrekCopilot AI** — trợ lý thám hiểm & sinh tồn chuyên biệt cho núi rừng Việt Nam.

Em có thể hỗ trợ bạn:
- **Tư vấn chọn cung theo thể lực**: Săn mây Lảo Thẩn, Tà Xùa; chinh phục Fansipan, Kỳ Quan San, Tà Năng - Phan Dũng...
- **Cứu hộ khẩn cấp & Sơ cấp cứu**: Sốc độ cao (AMS), lạc đường, hạ thân nhiệt & hotline kiểm lâm thật.
- **Checklist Balo & Thể lực**: Quy tắc 3 lớp áo, kiểm soát tải trọng dưới 20% thể trọng, bài tập 4 tuần trước khi đi.
- **Dự toán chi phí & Liên hệ Porter**.

*Bạn đang chuẩn bị cho chuyến đi nào, hoặc cần em hỗ trợ điều gì không ạ?*`,
      actions: [
        {
          type: 'quick_reply',
          suggestions: [
            'Gợi ý cung săn mây cho người mới',
            'Kế hoạch tập thể lực 4 tuần',
            'Checklist Balo 2N1Đ',
            'Cấp cứu khẩn cấp',
          ],
        },
      ],
      modelUsed: 'trekmap-knowledge-engine',
    };
  }

  // 2. FITNESS TRAINING
  if (q.includes('thể lực') || q.includes('tập luyện') || q.includes('chạy bộ') || q.includes('chuẩn bị thể lực')) {
    return {
      reply: `**KẾ HOẠCH TẬP THỂ LỰC CHUẨN BỊ LEO NÚI (4 TUẦN):**
- **Tuần 1 & 2**: Chạy bộ/đi bộ dốc 3-5km (3 buổi/tuần) + Leo cầu thang bộ 15-20 tầng/ngày.
- **Tuần 3**: Đeo balo nặng **4kg - 6kg** leo 25-30 tầng cầu thang + Squats (3 hiệp x 15) & Lunges chùng chân.
- **Tuần 4**: Giảm tải trước ngày đi 4 ngày, ngủ đủ giấc, bổ sung Magie/chuối chống chuột rút.`,
      actions: [
        {
          type: 'quick_reply',
          suggestions: ['Checklist đồ leo núi 2N1Đ', 'Tư vấn giày trekking', 'Cứu hộ khẩn cấp'],
        },
      ],
      modelUsed: 'trekmap-knowledge-engine',
    };
  }

  // 3. EMERGENCY SOS
  if (q.includes('cứu hộ') || q.includes('khẩn cấp') || q.includes('lạc đường') || q.includes('sốc độ cao') || q.includes('ams') || q.includes('hạ thân nhiệt') || q.includes('sos')) {
    actions.push({
      type: 'emergency_sos',
      emergencyContacts: FALLBACK_EMERGENCY_CONTACTS,
      suggestions: ['Xử lý sốc độ cao (AMS)', 'Quy tắc S.T.O.P khi lạc đường', 'Ủ ấm chống hạ thân nhiệt'],
    });

    return {
      reply: `**GIAO THỨC CỨU HỘ & XỬ LÝ KHẨN CẤP THỰC ĐỊA:**
1. **Sốc độ cao (AMS)**: Lập tức hạ độ cao xuống ít nhất 300m - 500m, giữ ấm cơ thể, bù nước Oresol.
2. **Lạc đường**: Giữ nguyên vị trí (nguyên tắc S.T.O.P), tuyệt đối không đi dọc khe suối cạn dễ gặp vực cụt, bật định vị GPS và dùng còi thổi 3 hồi ngắn báo hiệu SOS.
3. **Hạ thân nhiệt**: Thay trang phục ướt, chui vào túi ngủ, ủ ấm nách/ngực/bẹn bằng nước ấm.

*Danh bạ hotline cứu hộ khẩn cấp thực tế được hiển thị ngay bên dưới!*`,
      actions,
      modelUsed: 'trekmap-knowledge-engine',
    };
  }

  // 4. GEAR CHECKLIST
  if (q.includes('đồ') || q.includes('balo') || q.includes('trang bị') || q.includes('chuẩn bị') || q.includes('checklist')) {
    actions.push({
      type: 'gear_checklist',
      checklistItems: [
        {
          category: 'Trang phục & Giữ nhiệt (Quy tắc 3 lớp)',
          items: ['Áo thun thoát mồ hôi x2', 'Áo nỉ / lông vũ giữ nhiệt', 'Áo gió chống nước GORE-TEX', 'Quần trekking co giãn', 'Tất len merino x3 đôi'],
        },
        {
          category: 'Trang bị Di chuyển',
          items: ['Giày trekking đế gai Vibram', 'Gậy leo núi (Trekking poles)', 'Đèn pin đội đầu + Pin dự phòng', 'Túi nước 2-3L + Oresol', 'Áo mưa bộ'],
        },
        {
          category: 'Y tế & Sinh tồn',
          items: ['Băng gạc cá nhân + Povidine', 'Thuốc hạ sốt Paracetamol, Berberin', 'Kem chống vắt/muỗi DEET', 'Lương khô, Gel năng lượng, Bật lửa + Còi SOS'],
        },
      ],
      suggestions: ['Quy tắc trọng lượng balo dưới 20% thể trọng', 'Checklist Fansipan 2N1Đ'],
    });

    return {
      reply: `**CHECKLIST TRANG BỊ LEO NÚI CHUẨN SINH TỒN VIỆT NAM:**
- **Trọng lượng balo lý tưởng**: Tối đa 18% - 20% trọng lượng cơ thể.
- **Xếp đồ 3 tầng**: Đồ nhẹ/túi ngủ ở đáy, đồ nặng nhất (nước/đồ ăn) áp sát lưng ở giữa, đồ khẩn cấp (áo mưa/y tế/đèn pin) ở đỉnh.

*Xem và tích chọn danh mục bên dưới nhé!*`,
      actions,
      modelUsed: 'trekmap-knowledge-engine',
    };
  }

  // 5. TRAIL RECOMMENDATIONS
  const matched = mockTrails.filter((t) => q.includes(t.name.toLowerCase()) || q.includes(t.province.toLowerCase()));
  const chosen = matched.length > 0 ? matched : mockTrails.slice(0, 2);

  for (const tr of chosen.slice(0, 2)) {
    actions.push({
      type: 'trail_card',
      trailId: tr.id,
      trailName: tr.name,
      trailData: {
        id: tr.id,
        name: tr.name,
        province: tr.province,
        region: tr.region,
        distanceKm: tr.distanceKm,
        elevationGainM: tr.elevationGainM,
        maxAltitudeM: tr.maxAltitudeM,
        difficultyLevel: tr.difficultyLevel,
        difficultyNote: tr.difficultyNote,
        durationHoursNote: tr.durationHoursNote,
        coverImage: tr.coverImage,
      },
    });
  }

  return {
    reply: `**GỢI Ý CUNG ĐƯỜNG THỰC ĐỊA CHO BẠN:**
${chosen.map((t, idx) => `**${idx + 1}. ${t.name}**\n- Cao độ đỉnh: **${t.maxAltitudeM.toLocaleString()}m** (+${t.elevationGainM}m)\n- Cự ly: ${t.distanceKm}km (${t.durationHoursNote})\n- Địa điểm: ${t.province} (${t.region})\n- Mùa đẹp: Tháng ${t.bestMonths?.join(', ') || '10 - 4'}`).join('\n\n')}

*Bấm vào thẻ bên dưới để xem trực quan bản đồ 3D và tải file GPX!*`,
    actions,
    modelUsed: 'trekmap-knowledge-engine',
  };
}

/**
 * Send chat message to TrekCopilot AI
 */
export async function sendAiMessage(payload: ChatPayload): Promise<ChatResponse> {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          ...json.data,
          reply: removeEmojis(json.data.reply),
        };
      }
    }
  } catch (error) {
    console.warn('[AI Service] Backend call failed, using client-side knowledge engine:', error);
  }

  // Graceful client fallback
  return generateLocalFallback(payload.message, payload.currentTrailContext, payload.userName);
}

/**
 * Fetch Contextual Quick Prompts
 */
export async function fetchQuickPrompts(currentTrail?: { name?: string; province?: string }): Promise<string[]> {
  try {
    const query = new URLSearchParams();
    if (currentTrail?.name) query.append('trailName', currentTrail.name);
    if (currentTrail?.province) query.append('province', currentTrail.province);

    const res = await fetch(`${API_BASE}/quick-prompts?${query.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map(removeEmojis);
      }
    }
  } catch (error) {
    // Fallback
  }

  if (currentTrail?.name) {
    return [
      `Kinh nghiệm & lịch trình leo ${currentTrail.name}`,
      `Thời tiết và mùa đẹp nhất leo ${currentTrail.name}`,
      `Checklist balo & trang bị cho ${currentTrail.name}`,
      `Hotline cứu hộ & Porter dẫn đường tại ${currentTrail.province || currentTrail.name}`,
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
