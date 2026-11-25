import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Trail } from '../../types.js';
import { mockTrails } from '../../data/seedData.js';
import { VIETNAM_RANGER_STATIONS, type RangerStationSeed } from '../../data/vietnamDirectory.js';
import { getActiveStorageUid, scopedStorageKey } from '../../utils/storageScope.js';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconCompass,
  IconFlame,
  IconMapPin,
  IconMountain,
  IconRotateCw,
  IconShieldAlert,
  IconShieldCheck,
  IconSparkles,
  IconStar,
  IconX,
} from '../common/SvgIcons.js';

export interface VietnamPeakQuizPanelProps {
  trails: Trail[];
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type QuizCategory = 'all' | 'silhouette' | 'altitude_geo' | 'ranger_permit' | 'wfa_safety';
type SpecificCategory = Exclude<QuizCategory, 'all'>;
type QuizMode = 'round10' | 'endless';

interface SilhouettePoint {
  pct: number; // 0..100
  elevationM: number;
  isMilestone?: boolean;
  isPeak?: boolean;
  label?: string;
}

interface QuizQuestion {
  id: string;
  category: SpecificCategory;
  categoryLabel: string;
  prompt: string;
  subHint?: string;
  silhouette?: {
    points: SilhouettePoint[];
    minElevM: number;
    maxElevM: number;
    gainM: number;
    distanceKm: number;
    difficultyLevel: number;
    regionHint: string;
  };
  options: Array<{ id: 'A' | 'B' | 'C' | 'D'; text: string }>;
  correctOptionId: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  relatedTrailId?: string;
}

interface QuizBestRecord {
  bestRound10: number;
  bestRoundTotal: number;
  bestStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  roundsCompleted: number;
}

const QUIZ_STORAGE_KEY = 'lost_topo_quiz_best_v1';
const OPTION_LETTERS: ReadonlyArray<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
const ROUND_LENGTH = 10;

const CATEGORY_META: Record<
  QuizCategory,
  { label: string; shortLabel: string; color: string }
> = {
  all: { label: 'Tất cả (trộn 4 chủ đề)', shortLabel: 'Tất cả', color: 'var(--color-primary)' },
  silhouette: { label: 'Trắc dọc địa hình DEM', shortLabel: 'Trắc dọc DEM', color: 'var(--color-sky)' },
  altitude_geo: { label: 'Cao độ & địa lý đỉnh', shortLabel: 'Cao độ & địa lý', color: 'var(--color-sun)' },
  ranger_permit: { label: 'VQG, kiểm lâm & giấy phép', shortLabel: 'Kiểm lâm & phép', color: 'var(--color-stream)' },
  wfa_safety: { label: 'An toàn rừng núi WFA', shortLabel: 'An toàn WFA', color: 'var(--color-earth)' },
};

interface StaticWfaQuestion {
  id: string;
  prompt: string;
  subHint: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  relatedTrailId: string;
}

const WFA_FIELD_SCENARIOS: ReadonlyArray<StaticWfaQuestion> = [
  {
    id: 'wfa-taxua-lightning',
    prompt: 'Khi đang di chuyển trên sống lưng lộ thiên (như Sống Lưng Khủng Long Tà Xùa hoặc Kỳ Quan San) và nghe tiếng sấm cách chớp dưới 15 giây, hành động an toàn nhất là gì?',
    subHint: 'Quy tắc 30/30 phòng tránh sét đánh trên đỉnh trống vùng núi cao Tây Bắc',
    choices: [
      'Nằm sấp sát mặt đất dưới tán cây cổ thụ cao nhất sống núi để tránh mưa.',
      'Rời ngay sống núi lộ thiên xuống địa hình thấp hơn, tránh cây đứng đơn lẻ, ngồi xổm khép hai bàn chân trên vật cách điện (balo khô/tấm lót) và tách nhau tối thiểu 5–10m.',
      'Chạy nhanh lên chóp đỉnh để cắm cọc kim loại dựng lều tránh gió.',
      'Đứng tụm thành vòng tròn sát nhau và cầm chặt gậy trekking hợp kim hướng lên trời.',
    ],
    correctIndex: 1,
    explanation:
      'Khoảng cách chớp–sấm < 15 giây tương ứng cơn dông chỉ cách < 5 km. Tuyệt đối tránh đỉnh nhọn, sống núi trống, cây đơn lẻ và vật dẫn kim loại; hạ độ cao ngay, ngồi tư thế "lightning crouch" trên tấm cách điện khô và giữ giãn cách để giảm rủi ro dòng điện bước (step voltage).',
    relatedTrailId: 'trail-taxua',
  },
  {
    id: 'wfa-nuichua-hyponatremia',
    prompt: 'Trên tuyến VQG Núi Chúa nắng nóng 37°C, một thành viên uống rất nhiều nước lọc tinh khiết (5 lít trong 4 giờ) mà không nạp muối/điện giải, sau đó đau đầu, buồn nôn, bàn tay sưng nhẹ và lú lẫn. Nguy cơ nào cần nghĩ tới đầu tiên?',
    subHint: 'Tình huống rối loạn nước – điện giải điển hình tại rừng khô hạn Nam Trung Bộ',
    choices: [
      'Hạ natri máu do pha loãng (Exertional Hyponatremia) — ngừng uống nước lọc thêm, nghỉ mát và bổ sung điện giải/đồ ăn mặn nếu còn tỉnh, chuẩn bị sơ tán y tế.',
      'Say độ cao cấp tính (AMS) do đỉnh Chúa Anh vượt quá 1.000m.',
      'Thiếu nước trầm trọng — cần ép uống thêm ngay 2 lít nước lọc trắng.',
      'Hạ thân nhiệt do gió biển Đông thổi qua sườn núi.',
    ],
    correctIndex: 0,
    explanation:
      'Uống quá nhiều nước trắng không kèm muối khi đổ mồ hôi nặng làm tụt nồng độ Natri máu (Hyponatremia), gây phù não nguy hiểm tính mạng. Xử trí chuẩn: ngưng nạp thêm nước lọc, ăn đồ mặn/pha Oresol đúng tỷ lệ nếu còn tỉnh táo, theo dõi tri giác sát và gọi cứu hộ ngay nếu lú lẫn tăng.',
    relatedTrailId: 'trail-nuichua',
  },
  {
    id: 'wfa-pusilung-ams',
    prompt: 'Tại độ cao ~2.850m gần Cột Mốc 42 trên tuyến Pu Si Lung, một trekker đau đầu dữ dội, mất thăng bằng khi đi thẳng (Ataxia), thở dốc ngay cả lúc nghỉ và ho khạc đờm bọt hồng. Đây là dấu hiệu của tình trạng nào?',
    subHint: 'Chẩn đoán dấu hiệu cờ đỏ Y học Núi cao (High-Altitude Medicine)',
    choices: [
      'Cảm lạnh thông thường — chỉ cần uống trà gừng và tiếp tục leo lên chóp 3.083m.',
      'Biến chứng nặng do độ cao (HACE/HAPE) — PHẢI HẠ ĐỘ CAO KHẨN CẤP ngay lập tức tối thiểu 500–1.000m, giữ ấm và liên hệ cứu hộ.',
      'Chuột rút cơ đùi do mang balo quá nặng.',
      'Hạ đường huyết nhẹ — chỉ cần nghỉ 15 phút rồi ngủ lại tại độ cao 2.850m.',
    ],
    correctIndex: 1,
    explanation:
      'Mất thăng bằng (Ataxia) là dấu hiệu kinh điển của Phù não độ cao (HACE), còn thở dốc khi nghỉ kèm ho bọt hồng là dấu hiệu Phù phổi độ cao (HAPE). Phác đồ vàng duy nhất tại thực địa là "Descend, Descend, Descend" — lập tức hạ độ cao an toàn và sơ tán y tế.',
    relatedTrailId: 'trail-pusilung',
  },
  {
    id: 'wfa-nguchison-ankle',
    prompt: 'Khi đổ dốc trên địa hình đá granite Ngũ Chỉ Sơn, một thành viên lật cổ chân nghe tiếng "rắc", sưng nề nhanh và không thể dồn trọng lượng quá 4 bước. Xử trí tại chỗ chuẩn WFA?',
    subHint: 'Phân biệt bong gân nhẹ với chấn thương không thể chịu tải (Ottawa Ankle Rules)',
    choices: [
      'Cởi ngay giày trekking ra để chân trần đi tiếp cho nhẹ.',
      'Bóp dầu nóng thật mạnh và xoay khớp cổ chân liên tục để "trả khớp".',
      'Kiểm tra tuần hoàn – cảm giác – vận động (CSM) đầu ngón chân, cố định nẹp vững (giữ nguyên giày nếu không sưng siết mạch), chườm mát nếu có nước suối, chia tải balo và tổ chức hỗ trợ rút khỏi núi.',
      'Tiêm thuốc giảm đau và để nạn nhân đi một mình xuống trước.',
    ],
    correctIndex: 2,
    explanation:
      'Theo quy tắc Ottawa, mất khả năng chịu lực sau chấn thương cổ chân phải xử trí như nghi ngờ gãy xương/rách dây chằng nặng. Kiểm tra CSM (Circulation–Sensation–Motion), cố định khớp an toàn (tránh xoa bóp nóng làm tăng xuất huyết/sưng nề), san sẻ hành lý và hỗ trợ di chuyển ra khỏi địa hình hiểm trở.',
    relatedTrailId: 'trail-nguchison',
  },
  {
    id: 'wfa-bugiamap-leech',
    prompt: 'Khi lội suối Đắk Ka tại VQG Bù Gia Mập mùa ẩm, phát hiện vắt rừng bám chặt trên bắp chân. Cách gỡ vắt và xử lý vết cắn nào đúng y khoa rừng núi?',
    subHint: 'Phòng tránh nhiễm trùng thứ phát trong môi trường rừng nhiệt đới ẩm Nam Bộ',
    choices: [
      'Dùng bật lửa hơ trực tiếp hoặc rắc muối/thuốc lá khiến vắt nhả ra nhanh.',
      'Giật mạnh thẳng đứng thật nhanh để rút vắt ra ngay lập tức.',
      'Dùng cạnh thẻ cứng hoặc móng tay gạt nhẹ từ đầu giác hút cho vắt tự buông, rửa sạch bằng nước sạch/sát khuẩn nhẹ và băng ép gạc vô trùng vì chất chống đông Hirudin làm rỉ máu lâu.',
      'Bôi đất bùn suối lên vết cắn để cầm máu tự nhiên.',
    ],
    correctIndex: 2,
    explanation:
      'Hơ lửa, rắc muối hoặc giật mạnh có thể làm vắt nôn ngược vi khuẩn vào vết thương hoặc đứt hàm gây viêm loét kéo dài. Gạt ngang phần giác hút miệng, sát khuẩn bằng Povidone-Iodine/nước sạch và băng ép sạch là cách an toàn nhất.',
    relatedTrailId: 'trail-bugiamap',
  },
  {
    id: 'wfa-tanang-lost',
    prompt: 'Trên đồi cỏ Tà Năng – Phan Dũng có hàng chục lối mòn xe máy dân sinh cắt chéo. Khi nhận ra mình đã lạc khỏi đoàn hơn 20 phút và điện thoại mất sóng 4G, nguyên tắc sống còn S.T.O.P yêu cầu gì?',
    subHint: 'Quy trình ứng phó lạc rừng tiêu chuẩn Tìm kiếm Cứu nạn',
    choices: [
      'Chạy thật nhanh theo các lối mòn xuống khe suối càng sâu càng tốt để tìm nhà dân.',
      'Stop (Dừng lại ngay) – Think (Bình tĩnh kiểm tra GPS offline/tracklog) – Observe (Quan sát vị trí, lương thực, ánh sáng) – Plan (Giữ vị trí dễ thấy hoặc quay lại điểm chắc chắn cuối cùng, thổi còi 3 tiếng ngắt quãng và soạn tin SOS 2G khi có vạch sóng).',
      'Bỏ lại balo nước uống cho nhẹ để chạy đi tìm sóng điện thoại.',
      'Tắt nguồn điện thoại hoàn toàn và tiếp tục đi xuyên đêm theo trực giác.',
    ],
    correctIndex: 1,
    explanation:
      'Phần lớn các ca lạc rừng nghiêm trọng xảy ra khi nạn nhân hoảng loạn bỏ đi xa điểm mất dấu cuối cùng (Point Last Seen) hoặc lao xuống hẻm suối hiểm trở. Dừng lại ngay, bảo toàn nước/áo ấm, phát tín hiệu còi 3 hồi quốc tế và tận dụng tọa độ GPS offline (hoạt động không cần SIM/4G) giúp đội cứu hộ khoanh vùng nhanh nhất.',
    relatedTrailId: 'trail-tanangphandung',
  },
  {
    id: 'wfa-putaleng-frost',
    prompt: 'Tháng 1 trên đỉnh Pu Ta Leng (3.049m), nhiệt độ đêm xuống -1°C kèm sương muối đóng băng. Trong túi ngủ có 1 lớp lót cách nhiệt kém, giải pháp thực địa nào giúp tăng hiệu quả giữ ấm rõ rệt nhất?',
    subHint: 'Kiểm soát thất thoát nhiệt dẫn truyền (Conduction) trên đỉnh >3.000m mùa đông',
    choices: [
      'Mặc nguyên quần áo ướt mồ hôi chui vào túi ngủ để hơi ấm cơ thể làm khô dần.',
      'Đổ nước sôi vào chai nhựa chịu nhiệt vặn kín nắp bọc tất khô đặt ở chân/bẹn, thay toàn bộ đồ khô (gồm tất & mũ len), lót thêm tấm cách nhiệt/balo dưới lưng và ăn nhẹ đồ giàu năng lượng trước khi ngủ.',
      'Đốt bếp gas mini đóng kín cửa lều để sưởi ấm xuyên đêm.',
      'Uống rượu mạnh trước khi ngủ để làm ấm bàn tay và bàn chân.',
    ],
    correctIndex: 1,
    explanation:
      'Mặt đất lạnh rút nhiệt nhanh gấp nhiều lần không khí — tăng lớp cách nhiệt dưới lưng, mặc đồ khô ráo 100%, giữ ấm đầu bằng mũ len và dùng bình nước ấm an toàn giúp duy trì thân nhiệt ổn định. Tuyệt đối CẤM đốt bếp gas/than trong lều kín vì ngộ độc khí CO gây tử vong âm thầm.',
    relatedTrailId: 'trail-putaleng',
  },
  {
    id: 'wfa-yentu-fog',
    prompt: 'Khi xuống dốc bậc đá ẩm rêu trên Yên Tử hoặc VQG Ba Vì trong sương mù dày tầm nhìn dưới 10m lúc gần chạng vạng, nhóm 5 người cần áp dụng kỷ luật đội hình nào?',
    subHint: 'Kỹ thuật quản lý đoàn (Group Management) khi địa hình trơn và giảm tầm nhìn',
    choices: [
      'Ai khỏe cứ đi nhanh xuống trước về bãi xe chờ, người yếu tự đi chậm phía sau.',
      'Chỉ định chốt đầu (Leader) và chốt cuối (Sweeper), giữ cự ly luôn nhìn thấy nhau, bật sớm đèn đội đầu trước khi trời tối hẳn, hạ thấp trọng tâm và dùng gậy trekking hỗ trợ bậc đá trơn.',
      'Tắt hết đèn pin để mắt tự quen với bóng tối và sương mù.',
      'Cả đoàn cùng nắm tay nhau chạy nhanh qua đoạn bậc đá dốc để xuống trước khi tối.',
    ],
    correctIndex: 1,
    explanation:
      'Tách đoàn lúc chạng vạng là nguyên nhân hàng đầu gây lạc và chấn thương trơn trượt. Duy trì Leader – Sweeper, bật đèn đội đầu sớm (đặt góc chiếu thấp tránh chói phản xạ sương mù) và dừng kiểm đếm tại mọi ngã rẽ đảm bảo 100% thành viên xuống núi an toàn.',
    relatedTrailId: 'trail-yentu',
  },
  {
    id: 'wfa-chuyangsin-flashflood',
    prompt: 'Khi chuẩn bị lội qua suối lớn trên tuyến VQG Chư Yang Sin sau cơn mưa rừng thượng nguồn, bạn thấy dòng nước đột ngột chuyển đục ngầu, cuốn theo nhiều cành lá khô và có tiếng ầm rền từ phía trên. Hành động đúng chuẩn sinh tồn là gì?',
    subHint: 'Nhận diện sớm dấu hiệu lũ quét – lũ ống (Flash Flood) vùng núi Tây Nguyên & miền Trung',
    choices: [
      'Cả đoàn nắm tay nhau chạy thật nhanh sang bờ bên kia trước khi nước dâng cao hơn.',
      'Dừng vượt suối ngay lập tức, rút toàn bộ đoàn lên địa hình cao ráo xa lòng suối và tránh vách taluy dễ sạt lở; chỉ đánh giá lại khi nước rút hẳn trong trẻo hoặc liên hệ BQL VQG / Kiểm lâm hỗ trợ.',
      'Dựng lều ngay trên bãi cát bằng phẳng sát mép suối để chờ qua đêm.',
      'Tháo bỏ balo quăng sang bờ bên kia trước rồi từng người tự bơi qua.',
    ],
    correctIndex: 1,
    explanation:
      'Nước chuyển đục đột ngột kèm rác thực vật và tiếng gầm thượng nguồn là dấu hiệu kinh điển của lũ ống/lũ quét chỉ cách vài phút. Không bao giờ cố vượt dòng nước xiết (nước sâu quá đầu gối chảy xiết đã đủ cuốn trôi người trưởng thành); hãy lập tức lên cao, giữ ấm và tránh cắm trại ở bãi bồi lòng suối.',
    relatedTrailId: 'trail-chuyangsin',
  },
  {
    id: 'wfa-bachma-snakebite',
    prompt: 'Trong lúc băng rừng ẩm tại VQG Bạch Mã, một thành viên bị rắn lục đuôi đỏ cắn ở cẳng chân, vết răng nanh rỉ máu và sưng đau nhanh. Xử trí sơ cứu thực địa nào ĐÚNG chuẩn Bộ Y tế & WFA?',
    subHint: 'Xử trí rắn độc họ Lục (Viperidae — gây rối loạn đông máu & hoại tử mô tại chỗ)',
    choices: [
      'Dùng dao rạch rộng vết cắn, dùng miệng hút nọc ra và garô thật chặt phía trên đùi.',
      'Đắp lá rừng giã nát cùng muối hạt lên vết cắn rồi cho nạn nhân chạy nhanh ra cửa rừng.',
      'Giữ nạn nhân bình tĩnh nằm yên, hạn chế tối đa cử động chi bị cắn (nẹp bất động nhẹ ngang hoặc thấp hơn tim), tháo nhẫn/giày/tất chật trước khi sưng, rửa sạch vết thương nhẹ nhàng và nhanh chóng sơ tán tới cơ sở y tế có huyết thanh kháng nọc.',
      'Chườm đá lạnh trực tiếp lên vết cắn suốt 2 giờ và uống nhiều rượu mạnh để giải độc.',
    ],
    correctIndex: 2,
    explanation:
      'Garô chặt làm thiếu máu hoại tử chi nặng hơn (đặc biệt nguy hiểm với họ rắn lục), còn rạch/hút nọc bằng miệng hoặc đắp lá gây nhiễm trùng uốn ván và chảy máu không cầm. Phác đồ chuẩn là trấn an – bất động chi bị cắn – tháo đồ bó siết – vận chuyển cấp cứu (không để nạn nhân tự đi bộ) và ghi nhớ/chụp ảnh con rắn từ xa nếu an toàn.',
    relatedTrailId: 'trail-bachma',
  },
];

function createSeededRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffleWithRng<T>(items: ReadonlyArray<T>, rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function toSafeNonNegInt(value: unknown, maxCap = 1_000_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(maxCap, Math.max(0, Math.trunc(value)));
}

function readBestRecord(explicitUid?: string | null): QuizBestRecord {
  const fallback: QuizBestRecord = {
    bestRound10: 0,
    bestRoundTotal: ROUND_LENGTH,
    bestStreak: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    roundsCompleted: 0,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const scopedKey = scopedStorageKey(QUIZ_STORAGE_KEY, explicitUid);
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }
    const rec = parsed as Partial<QuizBestRecord>;
    const totalAnswered = toSafeNonNegInt(rec.totalAnswered);
    const totalCorrect = Math.min(totalAnswered, toSafeNonNegInt(rec.totalCorrect));
    const bestStreak = Math.min(totalCorrect, toSafeNonNegInt(rec.bestStreak));
    const bestRoundTotal = Math.max(1, toSafeNonNegInt(rec.bestRoundTotal ?? ROUND_LENGTH, ROUND_LENGTH));
    const bestRound10 = Math.min(bestRoundTotal, toSafeNonNegInt(rec.bestRound10, ROUND_LENGTH));
    const roundsCompleted = toSafeNonNegInt(rec.roundsCompleted, 100_000);
    return {
      bestRound10,
      bestRoundTotal,
      bestStreak,
      totalCorrect,
      totalAnswered,
      roundsCompleted,
    };
  } catch {
    return fallback;
  }
}

function saveBestRecord(record: QuizBestRecord, explicitUid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(scopedStorageKey(QUIZ_STORAGE_KEY, explicitUid), JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

function getExplorerRank(totalCorrect: number): { title: string; nextAt: number | null; color: string; tierIndex: number } {
  if (totalCorrect >= 60) {
    return { title: 'Chuyên gia địa hình Hoàng Liên', nextAt: null, color: 'var(--color-sun)', tierIndex: 4 };
  }
  if (totalCorrect >= 30) {
    return { title: 'Hoa tiêu dãy Trường Sơn', nextAt: 60, color: 'var(--color-primary)', tierIndex: 3 };
  }
  if (totalCorrect >= 12) {
    return { title: 'Trinh sát bản đồ', nextAt: 30, color: 'var(--color-sky)', tierIndex: 2 };
  }
  return { title: 'Tân binh thực địa', nextAt: 12, color: 'var(--color-text-muted)', tierIndex: 1 };
}

const ACTION_PREFIX_REGEX =
  /^(Hành Trình|Chinh Phục|Trekking|Khám Phá|Săn Biển Mây|Đại Ngàn Hoa Đỗ Quyên|Thảm Hoa Chi Pâu)\s+/i;

function shortTrailLabel(trail: Trail): string {
  let label = String(trail.name || '').trim();
  // Repeatedly strip stacked marketing/action prefixes (e.g. "Hành Trình Chinh Phục ...")
  let guard = 0;
  while (guard < 5 && ACTION_PREFIX_REGEX.test(label)) {
    label = label.replace(ACTION_PREFIX_REGEX, '').trim();
    guard += 1;
  }
  // Strip altitude annotations like "(1.296m)", "3143m", "3.049 m" so altitude_geo & silhouette options never spoil answers
  label = label
    .replace(/\s*\(\s*\d[\d.,]*\s*m\s*\)/gi, '')
    .replace(/\s*\(?\d[\d.,]*\s*m\)?/gi, (match) => {
      const startsParen = match.trimStart().startsWith('(');
      const endsParen = match.trimEnd().endsWith(')');
      if (startsParen && !endsParen) return ' (';
      if (!startsParen && endsParen) return ')';
      return '';
    })
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([),])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[-–—]\s*$/g, '')
    .trim();
  return label || trail.name;
}

function buildSilhouetteFromTrail(trail: Trail): NonNullable<QuizQuestion['silhouette']> {
  const safeMaxAlt =
    Number.isFinite(trail.maxAltitudeM) && trail.maxAltitudeM > 0 ? Math.round(trail.maxAltitudeM) : 1000;
  const safeGain =
    Number.isFinite(trail.elevationGainM) && trail.elevationGainM >= 0
      ? Math.round(trail.elevationGainM)
      : Math.max(100, Math.round(safeMaxAlt * 0.5));
  const safeDistanceKm =
    Number.isFinite(trail.distanceKm) && trail.distanceKm > 0 ? trail.distanceKm : 1;
  const safeDifficulty =
    Number.isFinite(trail.difficultyLevel) && trail.difficultyLevel >= 1
      ? Math.min(5, Math.round(trail.difficultyLevel))
      : 3;

  const rawWps = (trail.waypoints || []).filter(
    (w): w is NonNullable<Trail['waypoints']>[number] & { elevationM: number } =>
      typeof w.elevationM === 'number' && Number.isFinite(w.elevationM)
  );
  const points: SilhouettePoint[] = [];

  if (rawWps.length >= 2) {
    // Identify true highest waypoint so ridge / loop trails never falsely label a lower end waypoint as the summit
    let peakIdx = 0;
    let peakElev = -Infinity;
    rawWps.forEach((wp, idx) => {
      const clampedElev = Math.min(safeMaxAlt, Math.max(0, Math.round(wp.elevationM)));
      if (clampedElev > peakElev) {
        peakElev = clampedElev;
        peakIdx = idx;
      }
    });

    rawWps.forEach((wp, idx) => {
      const pct = Math.round((idx / (rawWps.length - 1)) * 100);
      const isLast = idx === rawWps.length - 1;
      const isPeak = idx === peakIdx && peakIdx > 0;
      let label: string;
      if (idx === 0) {
        label = 'Xuất phát';
      } else if (isPeak && isLast) {
        label = 'Đích / Đỉnh';
      } else if (isPeak) {
        label = 'Đỉnh cao nhất';
      } else if (isLast) {
        label = 'Kết thúc';
      } else {
        label = `Mốc ${idx + 1}`;
      }
      const clampedElev = Math.min(safeMaxAlt, Math.max(0, Math.round(wp.elevationM)));
      points.push({ pct, elevationM: clampedElev, isMilestone: true, isPeak, label });
    });
  } else {
    const startElev = Math.min(safeMaxAlt, Math.max(20, safeMaxAlt - safeGain));
    points.push(
      { pct: 0, elevationM: startElev, isMilestone: true, isPeak: false, label: 'Xuất phát' },
      { pct: 100, elevationM: safeMaxAlt, isMilestone: true, isPeak: true, label: 'Đích / Đỉnh' }
    );
  }

  const elevs = points.map((p) => p.elevationM).filter((v) => Number.isFinite(v));
  const minElevM = elevs.length > 0 ? Math.min(...elevs) : 0;

  return {
    points,
    minElevM,
    maxElevM: safeMaxAlt,
    gainM: safeGain,
    distanceKm: safeDistanceKm,
    difficultyLevel: safeDifficulty,
    regionHint: trail.region || 'Việt Nam',
  };
}

function getEffectiveStationTrailSlugs(station: RangerStationSeed): string[] {
  // Exclude mislinked Yên Tử from Hạt KL Bình Liêu (Mốc 1305 is ~150km away; Yên Tử has its own BQL station)
  if (station.slug === 'chi-cuc-kiem-lam-quang-ninh') {
    return station.coveredTrailSlugs.filter((slug) => slug !== 'trail-yentu');
  }
  return station.coveredTrailSlugs;
}

function buildQuestionBank(catalog: Trail[], seed: number): QuizQuestion[] {
  const trails = catalog.length >= 6 ? catalog : mockTrails;
  const rng = createSeededRng(seed);
  const trailById = new Map<string, Trail>(trails.map((t) => [t.id, t]));
  const questions: QuizQuestion[] = [];

  // 1. SILHOUETTE QUESTIONS (Pure-SVG Anonymized DEM Elevation Profile Recognition)
  const silhouettePool = shuffleWithRng(
    trails.filter((t) => {
      const validWps = (t.waypoints || []).filter(
        (w) => typeof w.elevationM === 'number' && Number.isFinite(w.elevationM)
      );
      return (
        validWps.length >= 3 &&
        Number.isFinite(t.maxAltitudeM) &&
        t.maxAltitudeM >= 450 &&
        Number.isFinite(t.elevationGainM)
      );
    }),
    rng
  );
  for (const target of silhouettePool.slice(0, 12)) {
    // Pick 3 distractors with noticeably distinct profiles or same region for challenge
    const distractorCandidates = shuffleWithRng(
      trails.filter((t) => t.id !== target.id && Math.abs(t.maxAltitudeM - target.maxAltitudeM) >= 60),
      rng
    ).slice(0, 3);
    if (distractorCandidates.length < 3) continue;

    const optionTrails = shuffleWithRng([target, ...distractorCandidates], rng);
    const correctIdx = optionTrails.findIndex((t) => t.id === target.id);
    const wpSummary = (target.waypoints || [])
      .map((w) =>
        typeof w.elevationM === 'number'
          ? `${w.name} (${w.elevationM.toLocaleString('vi-VN')}m)`
          : w.name
      )
      .join(' → ');

    questions.push({
      id: `sil-${target.id}-${seed}`,
      category: 'silhouette',
      categoryLabel: CATEGORY_META.silhouette.shortLabel,
      prompt: 'Quan sát trắc dọc cao độ DEM ẩn danh dưới đây — đây là cung đường thực địa nào của Việt Nam?',
      subHint: `Gợi ý khu vực: ${target.region} • Cấp độ ${target.difficultyLevel}/5 • Thời lượng ${target.durationDays} ngày`,
      silhouette: buildSilhouetteFromTrail(target),
      options: optionTrails.map((t, idx) => ({
        id: OPTION_LETTERS[idx],
        text: `${shortTrailLabel(t)} (${t.province})`,
      })),
      correctOptionId: OPTION_LETTERS[correctIdx],
      explanation: `Đây là ${target.name} (${target.district}, ${target.province}): đỉnh cao ${target.maxAltitudeM.toLocaleString('vi-VN')}m, tổng leo dốc +${target.elevationGainM.toLocaleString('vi-VN')}m, dài ${target.distanceKm} km. Lộ trình thực địa: ${wpSummary}.`,
      relatedTrailId: target.id,
    });
  }

  // 2. ALTITUDE & GEOGRAPHY QUESTIONS (Highest summit / Province-District / Best Season / Distance)
  const geoShuffled = shuffleWithRng(trails, rng);
  // 2A. Highest altitude among 4 distinct trails
  for (let i = 0; i + 3 < Math.min(20, geoShuffled.length); i += 4) {
    const group = geoShuffled.slice(i, i + 4);
    const uniqueAlts = new Set(group.map((t) => t.maxAltitudeM));
    if (uniqueAlts.size < 4) continue;
    const highest = [...group].sort((a, b) => b.maxAltitudeM - a.maxAltitudeM)[0];
    const ordered = shuffleWithRng(group, rng);
    const correctIdx = ordered.findIndex((t) => t.id === highest.id);
    questions.push({
      id: `alt-max-${highest.id}-${i}-${seed}`,
      category: 'altitude_geo',
      categoryLabel: CATEGORY_META.altitude_geo.shortLabel,
      prompt: 'Trong 4 tuyến trekking thực địa Việt Nam sau đây, tuyến nào sở hữu điểm cao độ lớn nhất?',
      subHint: 'So sánh cao độ đỉnh chuẩn kiểm định thực địa (m so với mực nước biển)',
      options: ordered.map((t, idx) => ({
        id: OPTION_LETTERS[idx],
        text: `${shortTrailLabel(t)} (${t.province})`,
      })),
      correctOptionId: OPTION_LETTERS[correctIdx],
      explanation: `${highest.name} đạt cao độ ${highest.maxAltitudeM.toLocaleString('vi-VN')}m (${highest.district}, ${highest.province}) — cao hơn ${ordered
        .filter((t) => t.id !== highest.id)
        .map((t) => `${shortTrailLabel(t)} (${t.maxAltitudeM.toLocaleString('vi-VN')}m)`)
        .join(', ')}.`,
      relatedTrailId: highest.id,
    });
  }

  // 2B. Province / District match for iconic peaks
  const provinceTargets = shuffleWithRng(
    trails.filter((t) => Boolean(t.district && t.province)),
    rng
  ).slice(0, 6);
  for (const target of provinceTargets) {
    const otherProvinces = Array.from(
      new Set(
        trails
          .filter((t) => t.province !== target.province)
          .map((t) => `${t.district}, ${t.province}`)
      )
    );
    const distractors = shuffleWithRng(otherProvinces, rng).slice(0, 3);
    if (distractors.length < 3) continue;
    const correctLoc = `${target.district}, ${target.province}`;
    const choices = shuffleWithRng([correctLoc, ...distractors], rng);
    const correctIdx = choices.indexOf(correctLoc);
    const bestMonthsList = Array.isArray(target.bestMonths) ? target.bestMonths.filter((m) => Number.isFinite(m)) : [];
    const avoidMonthsList = Array.isArray(target.avoidMonths) ? target.avoidMonths.filter((m) => Number.isFinite(m)) : [];
    const bestMonthsHint =
      bestMonthsList.length > 0 ? ` • Mùa đẹp nhất: Tháng ${bestMonthsList.slice(0, 4).join(', ')}` : '';
    const avoidMonthsNote =
      avoidMonthsList.length > 0 ? ` Mùa khuyến cáo tránh mưa lũ: Tháng ${avoidMonthsList.join(', ')}.` : '';

    questions.push({
      id: `geo-loc-${target.id}-${seed}`,
      category: 'altitude_geo',
      categoryLabel: CATEGORY_META.altitude_geo.shortLabel,
      prompt: `Tuyến "${shortTrailLabel(target)}" (${target.maxAltitudeM.toLocaleString('vi-VN')}m) thuộc địa bàn hành chính nào?`,
      subHint: `Khu vực: ${target.region}${bestMonthsHint}`,
      options: choices.map((c, idx) => ({ id: OPTION_LETTERS[idx], text: c })),
      correctOptionId: OPTION_LETTERS[correctIdx],
      explanation: `${target.name} nằm tại ${target.district}, ${target.province} (${target.region}), độ dài ${target.distanceKm} km, độ dốc tích lũy +${target.elevationGainM.toLocaleString('vi-VN')}m.${avoidMonthsNote}`,
      relatedTrailId: target.id,
    });
  }

  // 3. RANGER STATIONS & PERMITS (Powered strictly by real VIETNAM_RANGER_STATIONS)
  const linkedStations = VIETNAM_RANGER_STATIONS.filter(
    (s) => s.region !== 'Toàn Quốc' && getEffectiveStationTrailSlugs(s).length > 0
  );
  const stationPool = shuffleWithRng(linkedStations, rng);
  for (const station of stationPool.slice(0, 8)) {
    const stationSlugs = getEffectiveStationTrailSlugs(station);
    const sampleSlug = stationSlugs[Math.floor(rng() * stationSlugs.length)];
    const linkedTrail = trailById.get(sampleSlug);
    if (!linkedTrail) continue;

    const otherStations = shuffleWithRng(
      linkedStations.filter(
        (s) => s.slug !== station.slug && !getEffectiveStationTrailSlugs(s).includes(sampleSlug)
      ),
      rng
    ).slice(0, 3);
    if (otherStations.length < 3) continue;

    const opts = shuffleWithRng([station, ...otherStations], rng);
    const correctIdx = opts.findIndex((s) => s.slug === station.slug);
    questions.push({
      id: `rng-${station.slug}-${sampleSlug}-${seed}`,
      category: 'ranger_permit',
      categoryLabel: CATEGORY_META.ranger_permit.shortLabel,
      prompt: `Trước khi chinh phục "${shortTrailLabel(linkedTrail)}" (${linkedTrail.province}), bạn cần đăng ký thủ tục hoặc liên hệ đầu mối quản lý rừng chính quy nào?`,
      subHint: station.permitRequired
        ? `Tuyến có quy định khai báo / giấy phép (đăng ký trước ${station.permitLeadDays > 0 ? `${station.permitLeadDays} ngày` : 'tại cổng/chốt'})`
        : 'Đầu mối hỗ trợ an toàn & kiểm lâm địa bàn',
      options: opts.map((s: RangerStationSeed, idx) => ({
        id: OPTION_LETTERS[idx],
        text: s.name,
      })),
      correctOptionId: OPTION_LETTERS[correctIdx],
      explanation: `${station.name} (Hotline: ${station.hotlinePhone} • Khẩn cấp: ${station.emergencyPhone}) quản lý địa bàn này. Thủ tục thực tế: ${station.permitFeeNote}`,
      relatedTrailId: linkedTrail.id,
    });
  }

  // Add 2 essential National Emergency & Border Permit questions
  const national112Choices = shuffleWithRng(
    [
      { text: '112 — Tổng đài Tìm kiếm Cứu nạn Quốc gia', isCorrect: true },
      { text: '113 — Công an Phản ứng nhanh', isCorrect: false },
      { text: '114 — Cảnh sát PCCC & CNCH', isCorrect: false },
      { text: '115 — Trung tâm Cấp cứu Y tế', isCorrect: false },
    ],
    rng
  );
  const national112CorrectIdx = national112Choices.findIndex((c) => c.isCorrect);
  questions.push({
    id: `rng-national-112-${seed}`,
    category: 'ranger_permit',
    categoryLabel: CATEGORY_META.ranger_permit.shortLabel,
    prompt: 'Đầu số khẩn cấp quốc gia nào tại Việt Nam tiếp nhận tìm kiếm cứu nạn 24/7 trên mọi nhà mạng — kể cả khi máy báo "Chỉ cuộc gọi khẩn cấp" hoặc không có SIM?',
    subHint: 'Danh bạ khẩn cấp quốc gia Việt Nam (Quyết định Thủ tướng Chính phủ)',
    options: national112Choices.map((c, idx) => ({ id: OPTION_LETTERS[idx], text: c.text })),
    correctOptionId: OPTION_LETTERS[Math.max(0, national112CorrectIdx)],
    explanation:
      'Tổng đài 112 là đầu số tìm kiếm cứu nạn khẩn cấp thống nhất toàn quốc miễn phí 24/7, định tuyến ưu tiên trên mọi trạm BTS khả dụng (kể cả khác nhà mạng hoặc không lắp SIM) khi gặp lạc rừng, thiên tai hay tai nạn địa hình.',
    relatedTrailId: trails[0]?.id,
  });

  const borderPeaks = trails.filter((t) => t.id === 'trail-pusilung' || t.id === 'trail-khangsuvan');
  if (borderPeaks.length > 0) {
    const pickedBorder = borderPeaks[Math.floor(rng() * borderPeaks.length)];
    const nonBorder = shuffleWithRng(
      trails.filter(
        (t) => !['trail-pusilung', 'trail-khangsuvan', 'trail-laothan', 'trail-nhiucosan'].includes(t.id)
      ),
      rng
    ).slice(0, 3);
    if (nonBorder.length === 3) {
      const opts = shuffleWithRng([pickedBorder, ...nonBorder], rng);
      const correctIdx = opts.findIndex((t) => t.id === pickedBorder.id);
      questions.push({
        id: `rng-border-${pickedBorder.id}-${seed}`,
        category: 'ranger_permit',
        categoryLabel: CATEGORY_META.ranger_permit.shortLabel,
        prompt: 'Tuyến đỉnh >3.000m nào sau đây nằm sát đường biên giới Việt–Trung và BẮT BUỘC phải xin giấy phép biên giới tại Bộ Chỉ huy BĐBP tỉnh Lai Châu trước 3–5 ngày?',
        subHint: 'Kiểm tra quy định an ninh biên giới Tây Bắc',
        options: opts.map((t, idx) => ({
          id: OPTION_LETTERS[idx],
          text: `${shortTrailLabel(t)} (${t.province})`,
        })),
        correctOptionId: OPTION_LETTERS[correctIdx],
        explanation: `${pickedBorder.name} (${pickedBorder.district}, Lai Châu) nằm trong vùng vành đai biên giới. ${pickedBorder.permitInfo || 'Cần giấy phép BĐBP tỉnh Lai Châu trước 3–5 ngày và khai báo CCCD tại Đồn Biên phòng.'}`,
        relatedTrailId: pickedBorder.id,
      });
    }
  }

  // 4. WILDERNESS FIRST AID & MOUNTAIN SAFETY SCENARIOS (10 real Vietnam scenarios)
  const wfaPool = shuffleWithRng(WFA_FIELD_SCENARIOS, rng);
  for (const item of wfaPool) {
    const indexedChoices = item.choices.map((text, idx) => ({
      text,
      isCorrect: idx === item.correctIndex,
    }));
    const shuffledChoices = shuffleWithRng(indexedChoices, rng);
    const correctIdx = shuffledChoices.findIndex((c) => c.isCorrect);
    questions.push({
      id: `${item.id}-${seed}`,
      category: 'wfa_safety',
      categoryLabel: CATEGORY_META.wfa_safety.shortLabel,
      prompt: item.prompt,
      subHint: item.subHint,
      options: shuffledChoices.map((c, idx) => ({ id: OPTION_LETTERS[idx], text: c.text })),
      correctOptionId: OPTION_LETTERS[correctIdx],
      explanation: item.explanation,
      relatedTrailId: item.relatedTrailId,
    });
  }

  return shuffleWithRng(questions, rng);
}

function selectDeck(
  bank: QuizQuestion[],
  category: QuizCategory,
  mode: QuizMode,
  seed: number
): QuizQuestion[] {
  const filtered = category === 'all' ? bank : bank.filter((q) => q.category === category);
  const rng = createSeededRng(seed + 137);
  if (category === 'all' && mode === 'round10') {
    // Ensure balanced mix across all 4 categories in a 10-question round
    const byCat: Record<SpecificCategory, QuizQuestion[]> = {
      silhouette: shuffleWithRng(filtered.filter((q) => q.category === 'silhouette'), rng),
      altitude_geo: shuffleWithRng(filtered.filter((q) => q.category === 'altitude_geo'), rng),
      ranger_permit: shuffleWithRng(filtered.filter((q) => q.category === 'ranger_permit'), rng),
      wfa_safety: shuffleWithRng(filtered.filter((q) => q.category === 'wfa_safety'), rng),
    };
    const picked: QuizQuestion[] = [
      ...byCat.silhouette.slice(0, 3),
      ...byCat.altitude_geo.slice(0, 3),
      ...byCat.ranger_permit.slice(0, 2),
      ...byCat.wfa_safety.slice(0, 2),
    ];
    const usedIds = new Set(picked.map((q) => q.id));
    for (const q of shuffleWithRng(filtered, rng)) {
      if (picked.length >= ROUND_LENGTH) break;
      if (!usedIds.has(q.id)) {
        picked.push(q);
        usedIds.add(q.id);
      }
    }
    return shuffleWithRng(picked, rng).slice(0, ROUND_LENGTH);
  }
  const shuffled = shuffleWithRng(filtered, rng);
  return mode === 'round10' ? shuffled.slice(0, Math.min(ROUND_LENGTH, shuffled.length)) : shuffled;
}

export const VietnamPeakQuizPanel: React.FC<VietnamPeakQuizPanelProps> = ({
  trails,
  onSelectTrail,
  onShowToast,
}) => {
  const effectiveTrails = useMemo(() => (trails.length >= 6 ? trails : mockTrails), [trails]);
  const trailById = useMemo(() => new Map<string, Trail>(effectiveTrails.map((t) => [t.id, t])), [effectiveTrails]);

  const [category, setCategory] = useState<QuizCategory>('all');
  const [mode, setMode] = useState<QuizMode>('round10');
  const [deckSeed, setDeckSeed] = useState<number>(() => (Date.now() % 100000) + 17);
  const [activeStorageUid, setActiveStorageUid] = useState<string>(() => getActiveStorageUid());
  const [bestRecord, setBestRecord] = useState<QuizBestRecord>(() => readBestRecord(getActiveStorageUid()));

  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [roundScore, setRoundScore] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [roundFinished, setRoundFinished] = useState<boolean>(false);
  const [categoryTally, setCategoryTally] = useState<
    Record<SpecificCategory, { correct: number; total: number }>
  >({
    silhouette: { correct: 0, total: 0 },
    altitude_geo: { correct: 0, total: 0 },
    ranger_permit: { correct: 0, total: 0 },
    wfa_safety: { correct: 0, total: 0 },
  });

  // Reload per-user quiz record cleanly whenever account switches (prevents cross-user leak)
  useEffect(() => {
    const syncAccountScope = () => {
      const nextUid = getActiveStorageUid();
      setActiveStorageUid((prevUid) => {
        if (prevUid !== nextUid) {
          setBestRecord(readBestRecord(nextUid));
          setCurrentStreak(0);
        }
        return nextUid;
      });
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== null && ev.key !== 'lost_token' && !ev.key.startsWith(QUIZ_STORAGE_KEY)) return;
      const nextUid = getActiveStorageUid();
      setActiveStorageUid(nextUid);
      setBestRecord(readBestRecord(nextUid));
    };
    window.addEventListener('lost:auth-changed', syncAccountScope);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('lost:auth-changed', syncAccountScope);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const fullBank = useMemo(() => buildQuestionBank(effectiveTrails, deckSeed), [effectiveTrails, deckSeed]);
  const deck = useMemo(
    () => selectDeck(fullBank, category, mode, deckSeed),
    [fullBank, category, mode, deckSeed]
  );

  const currentQuestion = deck[questionIndex] || deck[0] || null;
  const relatedTrail = currentQuestion?.relatedTrailId ? trailById.get(currentQuestion.relatedTrailId) || null : null;
  const explorerRank = getExplorerRank(bestRecord.totalCorrect);

  const startFreshSession = useCallback(
    (nextCategory: QuizCategory, nextMode: QuizMode) => {
      setCategory(nextCategory);
      setMode(nextMode);
      setDeckSeed((s) => s + 97);
      setQuestionIndex(0);
      setSelectedOption(null);
      setRoundScore(0);
      setCurrentStreak(0);
      setRoundFinished(false);
      setCategoryTally({
        silhouette: { correct: 0, total: 0 },
        altitude_geo: { correct: 0, total: 0 },
        ranger_permit: { correct: 0, total: 0 },
        wfa_safety: { correct: 0, total: 0 },
      });
    },
    []
  );

  const handleChooseOption = useCallback(
    (optId: 'A' | 'B' | 'C' | 'D') => {
      if (!currentQuestion || selectedOption !== null) return;
      setSelectedOption(optId);
      const isRight = optId === currentQuestion.correctOptionId;
      const nextScore = isRight ? roundScore + 1 : roundScore;
      const nextStreak = isRight ? currentStreak + 1 : 0;
      const isLastInRound = mode === 'round10' && questionIndex + 1 >= deck.length;

      setRoundScore(nextScore);
      setCurrentStreak(nextStreak);
      setCategoryTally((prev) => ({
        ...prev,
        [currentQuestion.category]: {
          correct: prev[currentQuestion.category].correct + (isRight ? 1 : 0),
          total: prev[currentQuestion.category].total + 1,
        },
      }));

      const completedRoundDenom = Math.max(1, Math.min(ROUND_LENGTH, deck.length));

      setBestRecord((prev) => {
        let nextBestScore = prev.bestRound10;
        let nextBestTotal = prev.bestRoundTotal;
        if (isLastInRound && deck.length > 0) {
          const prevPct = prev.bestRoundTotal > 0 ? prev.bestRound10 / prev.bestRoundTotal : 0;
          const nextPct = nextScore / completedRoundDenom;
          if (
            prev.roundsCompleted === 0 ||
            nextPct > prevPct ||
            (nextPct === prevPct && nextScore > prev.bestRound10)
          ) {
            nextBestScore = Math.min(completedRoundDenom, nextScore);
            nextBestTotal = completedRoundDenom;
          }
        }
        const updated: QuizBestRecord = {
          bestRound10: nextBestScore,
          bestRoundTotal: nextBestTotal,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
          totalCorrect: prev.totalCorrect + (isRight ? 1 : 0),
          totalAnswered: prev.totalAnswered + 1,
          roundsCompleted: prev.roundsCompleted + (isLastInRound ? 1 : 0),
        };
        saveBestRecord(updated, activeStorageUid);
        return updated;
      });
    },
    [currentQuestion, selectedOption, roundScore, currentStreak, mode, questionIndex, deck.length, activeStorageUid]
  );

  const handleNextQuestion = useCallback(() => {
    if (!currentQuestion || selectedOption === null) return;
    if (mode === 'round10' && questionIndex + 1 >= deck.length) {
      setRoundFinished(true);
      onShowToast?.(`Hoàn thành vòng thử tài: ${roundScore}/${deck.length} câu đúng!`, 'success');
      return;
    }
    if (questionIndex + 1 >= deck.length) {
      // Endless mode reshuffles fresh deck seamlessly
      setDeckSeed((s) => s + 131);
      setQuestionIndex(0);
      setSelectedOption(null);
      return;
    }
    setQuestionIndex((idx) => idx + 1);
    setSelectedOption(null);
  }, [currentQuestion, selectedOption, mode, questionIndex, deck.length, onShowToast, roundScore]);

  // Keyboard shortcuts: 1-4 / A-D to answer, Enter for next question (ignoring inputs/IME & open modals)
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return Boolean(el.closest('[contenteditable="true"]'));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        typeof document !== 'undefined' &&
        document.querySelector('[role="dialog"][aria-modal="true"], [aria-modal="true"]')
      ) {
        return;
      }
      if (isEditable(e.target) || isEditable(document.activeElement)) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (roundFinished) return;
      if (selectedOption === null) {
        const keyMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
          '1': 'A',
          '2': 'B',
          '3': 'C',
          '4': 'D',
          a: 'A',
          b: 'B',
          c: 'C',
          d: 'D',
        };
        const mapped = keyMap[e.key.toLowerCase()];
        if (mapped) {
          e.preventDefault();
          handleChooseOption(mapped);
        }
      } else if (e.key === 'Enter') {
        if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) return;
        e.preventDefault();
        handleNextQuestion();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [roundFinished, selectedOption, handleChooseOption, handleNextQuestion]);

  // Pure Inline SVG Geometry for Anonymized DEM Elevation Silhouette
  const silhouetteSvg = useMemo(() => {
    const sil = currentQuestion?.silhouette;
    if (!sil) return null;
    const W = 560;
    const H = 192;
    const padL = 48;
    const padR = 18;
    const padT = 24;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const safeMin = Number.isFinite(sil.minElevM) ? sil.minElevM : 0;
    const safeMax = Number.isFinite(sil.maxElevM) && sil.maxElevM > 0 ? sil.maxElevM : 1000;
    const elevFloor = Math.max(0, Math.floor((safeMin - 80) / 100) * 100);
    const elevCeil = Math.ceil((safeMax + 100) / 100) * 100;
    const span = Math.max(100, elevCeil - elevFloor);

    const toX = (pct: number) => {
      const clamped = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
      return padL + (clamped / 100) * plotW;
    };
    const toY = (m: number) => {
      const safeVal = Number.isFinite(m) ? m : safeMin;
      return padT + ((elevCeil - safeVal) / span) * plotH;
    };

    const coords = sil.points.map((p) => ({
      ...p,
      x: toX(p.pct),
      y: toY(p.elevationM),
    }));

    const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const baseLineY = padT + plotH;
    const areaPoints = [
      `${padL},${baseLineY}`,
      ...coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`),
      `${padL + plotW},${baseLineY}`,
    ].join(' ');

    const gridLevels = [0, 0.33, 0.66, 1].map((f) => {
      const val = Math.round(elevFloor + span * f);
      return { val, y: toY(val) };
    });

    const rawMilestones = coords.filter((c) => c.isMilestone);
    // Compute non-overlapping label visibility & vertical stagger for dense 5–6+ waypoint trails
    const lastIdx = rawMilestones.length - 1;
    let lastLabeledX = -Infinity;
    const milestones = rawMilestones.map((m, idx) => {
      const isEdge = idx === 0 || idx === lastIdx;
      const distFromLast = m.x - lastLabeledX;
      const distToEnd = lastIdx > 0 ? rawMilestones[lastIdx].x - m.x : Infinity;
      const showLabel = isEdge || (distFromLast >= 74 && distToEnd >= 68);
      if (showLabel) {
        lastLabeledX = m.x;
      }
      const staggerRow = !isEdge && idx % 2 === 1 ? 1 : 0;
      return { ...m, showLabel, staggerRow };
    });
    return { W, H, padL, padR, padT, padB, plotW, baseLineY, linePoints, areaPoints, gridLevels, milestones };
  }, [currentQuestion]);

  const progressPct =
    mode === 'round10' && deck.length > 0
      ? Math.round(((questionIndex + (selectedOption !== null ? 1 : 0)) / deck.length) * 100)
      : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Field-Atlas Header & Personal Best Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          borderTop: '3px solid var(--color-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
                marginBottom: 4,
              }}
            >
              THỬ TÀI ĐỊA HÌNH &amp; SINH TỒN VIỆT NAM • 100% NGOẠI TUYẾN
            </div>
            <h2
              className="font-editorial"
              style={{ margin: 0, fontSize: 'clamp(1.15rem, 2.2vw, 1.45rem)', fontWeight: 700, color: 'var(--color-text-main)' }}
            >
              Nhận diện trắc dọc DEM {effectiveTrails.length} đỉnh núi &amp; kiểm lâm thực địa
            </h2>
            <p style={{ margin: '5px 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Rèn phản xạ đọc biểu đồ cao độ DEM ẩn danh, ghi nhớ vị trí {effectiveTrails.length} đỉnh núi, {VIETNAM_RANGER_STATIONS.length} trạm kiểm lâm – VQG và phác đồ xử trí tình huống rừng núi WFA.
            </p>
          </div>

          {/* Rank & High Score Telemetry Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(115px, 100%), 1fr))',
              gap: 8,
              flex: '1 1 320px',
              maxWidth: 460,
            }}
          >
            <div
              style={{
                padding: '9px 11px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Cấp bậc
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: explorerRank.color, marginTop: 2, lineHeight: 1.25 }}>
                {explorerRank.title}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {explorerRank.nextAt
                  ? `${bestRecord.totalCorrect}/${explorerRank.nextAt} câu đúng`
                  : `${bestRecord.totalCorrect} câu đúng (Đỉnh cao)`}
              </div>
            </div>

            <div
              style={{
                padding: '9px 11px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Kỷ lục vòng chơi
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
                {bestRecord.bestRound10}/{bestRecord.bestRoundTotal}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
                {bestRecord.roundsCompleted} vòng đã chơi ({Math.round((bestRecord.bestRound10 / Math.max(1, bestRecord.bestRoundTotal)) * 100)}%)
              </div>
            </div>

            <div
              style={{
                padding: '9px 11px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Chuỗi đúng dài nhất
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-sun)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconFlame size={15} color="var(--color-sun)" />
                <span>{bestRecord.bestStreak}</span>
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
                Hiện tại: {currentStreak}
              </div>
            </div>
          </div>
        </div>

        {/* Mode & Category Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            paddingTop: 12,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Lọc chủ đề câu hỏi">
            {(['all', 'silhouette', 'altitude_geo', 'ranger_permit', 'wfa_safety'] as QuizCategory[]).map((cat) => {
              const active = category === cat;
              const meta = CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => startFreshSession(cat, mode)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    border: active ? `1px solid ${meta.color}` : '1px solid var(--color-border)',
                    background: active
                      ? `color-mix(in srgb, ${meta.color} 15%, var(--color-bg-main))`
                      : 'var(--color-bg-main)',
                    color: active ? meta.color : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {cat === 'silhouette' && <IconMountain size={13} />}
                  {cat === 'altitude_geo' && <IconCompass size={13} />}
                  {cat === 'ranger_permit' && <IconShieldCheck size={13} />}
                  {cat === 'wfa_safety' && <IconShieldAlert size={13} />}
                  {cat === 'all' && <IconSparkles size={13} />}
                  <span>{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Chế độ chơi">
            {[
              { id: 'round10' as const, label: 'Vòng 10 câu' },
              { id: 'endless' as const, label: 'Chuỗi vô tận' },
            ].map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => startFreshSession(category, m.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: active
                      ? 'var(--color-primary)'
                      : 'var(--color-bg-main)',
                    color: active ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Round Finished Summary Card */}
      {roundFinished ? (
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            borderTop: '3px solid var(--color-sun)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-sun)' }}>
                TỔNG KẾT VÒNG THỬ TÀI ĐỊA HÌNH
              </div>
              {(() => {
                const roundPct = Math.round((roundScore / Math.max(1, deck.length)) * 100);
                return (
                  <>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                      Bạn trả lời đúng {roundScore}/{deck.length} câu ({roundPct}%)
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      {roundPct >= 90
                        ? 'Xuất sắc! Bạn nắm vững trắc dọc DEM, địa lý vùng núi và quy trình sinh tồn như một Hoa tiêu thực thụ.'
                        : roundPct >= 70
                          ? 'Rất tốt! Nền tảng kiến thức địa hình và thủ tục VQG của bạn đã sẵn sàng cho các cung Tây Bắc.'
                          : 'Tiếp tục luyện thêm với chế độ lọc từng chủ đề để ghi nhớ chắc chắn tọa độ kiểm lâm và dấu hiệu an toàn WFA.'}
                    </p>
                  </>
                );
              })()}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => startFreshSession(category, mode)}
              style={{ borderRadius: 4, fontSize: '0.82rem' }}
            >
              <IconRotateCw size={15} color="var(--color-on-primary)" />
              <span>Chơi vòng mới (đề ngẫu nhiên)</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
              gap: 10,
            }}
          >
            {(['silhouette', 'altitude_geo', 'ranger_permit', 'wfa_safety'] as SpecificCategory[]).map((catKey) => {
              const t = categoryTally[catKey];
              if (t.total === 0) return null;
              const pct = Math.round((t.correct / t.total) * 100);
              const meta = CATEGORY_META[catKey];
              return (
                <div
                  key={catKey}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${meta.color}`,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: meta.color }}>{meta.shortLabel}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 3 }}>
                    {t.correct}/{t.total} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : currentQuestion ? (
        /* Active Question Card */
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress & Metadata Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 8px',
                    borderRadius: 4,
                    color: CATEGORY_META[currentQuestion.category].color,
                    background: `color-mix(in srgb, ${CATEGORY_META[currentQuestion.category].color} 14%, var(--color-bg-main))`,
                    border: `1px solid color-mix(in srgb, ${CATEGORY_META[currentQuestion.category].color} 32%, transparent)`,
                  }}
                >
                  {currentQuestion.categoryLabel}
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {mode === 'round10' ? `Câu ${questionIndex + 1} / ${deck.length}` : `Chuỗi hiện tại: ${currentStreak} câu đúng`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                  Điểm phiên: {roundScore}
                </span>
                <button
                  type="button"
                  onClick={() => startFreshSession(category, mode)}
                  aria-label="Tạo bộ câu hỏi mới"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 9px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-main)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  <IconRotateCw size={12} />
                  <span>Đổi đề</span>
                </button>
              </div>
            </div>

            {mode === 'round10' && (
              <div
                aria-label={`Tiến độ vòng thử tài ${progressPct}%`}
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--color-bg-main)',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
            )}
          </div>

          {/* Question Title & Hint */}
          <div>
            <h3 style={{ margin: 0, fontSize: 'clamp(0.98rem, 1.8vw, 1.12rem)', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.45 }}>
              {currentQuestion.prompt}
            </h3>
            {currentQuestion.subHint && (
              <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
                {currentQuestion.subHint}
              </p>
            )}
          </div>

          {/* Pure-SVG Anonymized DEM Elevation Profile Silhouette */}
          {currentQuestion.silhouette && silhouetteSvg && (
            <div
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 6,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontSize: '0.74rem',
                  color: 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--color-sky)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <IconMountain size={14} color="var(--color-sky)" />
                  Trắc dọc DEM ẩn danh
                </span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>Đỉnh cao: <strong style={{ color: 'var(--color-text-main)' }}>{currentQuestion.silhouette.maxElevM.toLocaleString('vi-VN')}m</strong></span>
                  <span>Leo dốc: <strong style={{ color: 'var(--color-earth)' }}>+{currentQuestion.silhouette.gainM.toLocaleString('vi-VN')}m</strong></span>
                  <span>Cự ly: <strong style={{ color: 'var(--color-primary)' }}>{currentQuestion.silhouette.distanceKm} km</strong></span>
                </div>
              </div>

              <svg
                viewBox={`0 0 ${silhouetteSvg.W} ${silhouetteSvg.H}`}
                role="img"
                aria-label={`Biểu đồ trắc dọc cao độ ẩn danh: đỉnh ${currentQuestion.silhouette.maxElevM}m, tổng leo dốc ${currentQuestion.silhouette.gainM}m, dài ${currentQuestion.silhouette.distanceKm}km`}
                style={{ width: '100%', height: 'auto', display: 'block', maxWidth: '100%' }}
              >
                {/* Horizontal elevation gridlines */}
                {silhouetteSvg.gridLevels.map((g) => (
                  <g key={g.val}>
                    <line
                      x1={silhouetteSvg.padL}
                      y1={g.y}
                      x2={silhouetteSvg.W - silhouetteSvg.padR}
                      y2={g.y}
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={silhouetteSvg.padL - 6}
                      y={g.y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill="var(--color-text-dim)"
                    >
                      {g.val}m
                    </text>
                  </g>
                ))}

                {/* Shaded terrain silhouette */}
                <polygon
                  points={silhouetteSvg.areaPoints}
                  fill="color-mix(in srgb, var(--color-primary) 18%, transparent)"
                />

                {/* Elevation ridge profile line */}
                <polyline
                  points={silhouetteSvg.linePoints}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Anonymized milestone nodes (staggered & de-collided for mobile readability) */}
                {silhouetteSvg.milestones.map((m, idx) => {
                  const isLast = idx === silhouetteSvg.milestones.length - 1;
                  const isPeak = Boolean(m.isPeak);
                  const clampedX = Math.min(silhouetteSvg.W - silhouetteSvg.padR - 4, Math.max(silhouetteSvg.padL + 4, m.x));
                  const elevY = Math.max(13, m.y - (m.staggerRow === 1 ? 12 : 8));
                  const labelY = silhouetteSvg.H - (m.staggerRow === 1 ? 18 : 6);
                  return (
                    <g key={`${m.pct}-${idx}`}>
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={isPeak ? 4.5 : 3.5}
                        fill={isPeak ? 'var(--color-sun)' : 'var(--color-sky)'}
                        stroke="var(--color-bg-card)"
                        strokeWidth="1.5"
                      />
                      {m.showLabel && (
                        <>
                          <text
                            x={clampedX}
                            y={elevY}
                            textAnchor={idx === 0 ? 'start' : isLast ? 'end' : 'middle'}
                            fontSize="10"
                            fontWeight="700"
                            fill={isPeak ? 'var(--color-sun)' : 'var(--color-text-main)'}
                          >
                            {m.elevationM.toLocaleString('vi-VN')}m
                          </text>
                          <text
                            x={clampedX}
                            y={labelY}
                            textAnchor={idx === 0 ? 'start' : isLast ? 'end' : 'middle'}
                            fontSize="9.5"
                            fill="var(--color-text-dim)"
                          >
                            {m.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* 4 Multiple-Choice Options */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
              gap: 10,
            }}
          >
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const isCorrect = opt.id === currentQuestion.correctOptionId;
              const revealed = selectedOption !== null;

              let borderColor = 'var(--color-border-strong)';
              let bg = 'var(--color-bg-main)';
              let badgeBg = 'var(--color-surface-elevated)';
              let badgeColor = 'var(--color-text-main)';

              if (revealed && isCorrect) {
                borderColor = 'var(--color-primary)';
                bg = 'color-mix(in srgb, var(--color-primary) 13%, var(--color-bg-card))';
                badgeBg = 'var(--color-primary)';
                badgeColor = 'var(--color-on-primary)';
              } else if (revealed && isSelected && !isCorrect) {
                borderColor = 'var(--color-error)';
                bg = 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg-card))';
                badgeBg = 'var(--color-error)';
                badgeColor = 'var(--color-on-danger)';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={revealed}
                  aria-pressed={isSelected}
                  onClick={() => handleChooseOption(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    textAlign: 'left',
                    padding: '11px 13px',
                    borderRadius: 6,
                    border: `1px solid ${borderColor}`,
                    background: bg,
                    color: 'var(--color-text-main)',
                    cursor: revealed ? 'default' : 'pointer',
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.84rem',
                    lineHeight: 1.45,
                    opacity: revealed && !isCorrect && !isSelected ? 0.62 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      background: badgeBg,
                      color: badgeColor,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {revealed && isCorrect ? (
                      <IconCheck size={14} color="var(--color-on-primary)" />
                    ) : revealed && isSelected && !isCorrect ? (
                      <IconX size={14} color="var(--color-on-danger)" />
                    ) : (
                      opt.id
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Instant Geographical / Clinical Explanation & Trail Jump */}
          {selectedOption !== null && (
            <div
              role="status"
              style={{
                padding: '13px 15px',
                borderRadius: 6,
                background:
                  selectedOption === currentQuestion.correctOptionId
                    ? 'color-mix(in srgb, var(--color-primary) 11%, var(--color-bg-main))'
                    : 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))',
                border:
                  selectedOption === currentQuestion.correctOptionId
                    ? '1px solid color-mix(in srgb, var(--color-primary) 38%, var(--color-border))'
                    : '1px solid color-mix(in srgb, var(--color-error) 38%, var(--color-border))',
                borderLeft:
                  selectedOption === currentQuestion.correctOptionId
                    ? '3px solid var(--color-primary)'
                    : '3px solid var(--color-error)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.84rem', fontWeight: 800 }}>
                {selectedOption === currentQuestion.correctOptionId ? (
                  <>
                    <IconCheckCircle size={16} color="var(--color-primary)" />
                    <span style={{ color: 'var(--color-primary)' }}>Chính xác! +1 điểm địa hình thực địa</span>
                  </>
                ) : (
                  <>
                    <IconAlertTriangle size={16} color="var(--color-error-text, var(--banner-danger-text))" />
                    <span style={{ color: 'var(--color-error-text, var(--banner-danger-text))' }}>
                      Chưa đúng — Đáp án chính xác là phương án {currentQuestion.correctOptionId}
                    </span>
                  </>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-main)', lineHeight: 1.55 }}>
                {currentQuestion.explanation}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {relatedTrail && onSelectTrail && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => onSelectTrail(relatedTrail)}
                      style={{ borderRadius: 4, fontSize: '0.78rem', padding: '7px 12px' }}
                    >
                      <IconMapPin size={14} color="var(--color-primary)" />
                      <span>Mở cung này ({shortTrailLabel(relatedTrail)})</span>
                    </button>
                  )}
                  <span style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IconStar size={12} color="var(--color-sun)" />
                    Phím tắt: 1–4 / A–D chọn nhanh • Enter câu tiếp
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextQuestion}
                  style={{ borderRadius: 4, fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  <span>
                    {mode === 'round10' && questionIndex + 1 >= deck.length
                      ? 'Xem tổng kết vòng'
                      : 'Câu tiếp theo'}
                  </span>
                  <IconArrowRight size={15} color="var(--color-on-primary)" />
                </button>
              </div>
            </div>
          )}

          {selectedOption === null && (
            <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconStar size={12} color="var(--color-sun)" />
              Mẹo: Nhấn phím 1–4 hoặc A–D để chọn nhanh, Enter để sang câu tiếp
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
