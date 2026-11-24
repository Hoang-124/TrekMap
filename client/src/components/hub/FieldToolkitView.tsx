import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trail } from '../../types.js';
import type { AiFitnessLevel, BioCalcResult } from '../ai-assistant/ai.types.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import { VIETNAM_RANGER_STATIONS, type RangerStationSeed } from '../../data/vietnamDirectory.js';
import { buildOfflineSosSmsUri } from '../../utils/geoMath.js';
import { computeClientBioMetrics } from '../../utils/gpxParser.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import {
  calculateBearingDeg,
  calculateHaversineKm,
  calculateSolarTimes,
  decimalToDms,
  dmsToDecimal,
  formatHoursToHHMM,
  getCardinalDirectionLabel,
  type CardinalHemisphere,
} from '../../utils/solarMath.js';
import {
  clearIceCardProfile,
  computeAltitudePhysics,
  DEFAULT_ICE_CARD_PROFILE,
  ICE_BLOOD_TYPES,
  ISA_VIETNAM_BENCHMARKS,
  loadIceCardProfile,
  renderIceLockscreenPng,
  saveIceCardProfile,
  type IceCardProfile,
  type IceLockscreenTheme,
} from '../../utils/iceLockscreenCard.js';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBackpack,
  IconBookOpen,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconCloud,
  IconCompass,
  IconCopy,
  IconDownload,
  IconDroplet,
  IconFlame,
  IconImage,
  IconLock,
  IconMapPin,
  IconMountain,
  IconPhone,
  IconPhoneCall,
  IconRadio,
  IconRotateCw,
  IconSend,
  IconShare,
  IconShieldAlert,
  IconShieldCheck,
  IconSun,
  IconTrash,
  IconWaveform,
  IconX,
} from '../common/SvgIcons.js';
import { OfflineStoragePanel } from '../common/OfflineStoragePanel.js';
import { VietnamPeakQuizPanel } from './VietnamPeakQuizPanel.js';

export interface FieldToolkitViewProps {
  trails: Trail[];
  initialTrailId?: string;
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

type ToolkitTab = 'compass' | 'solar' | 'bio' | 'sos' | 'academy' | 'offline' | 'quiz';

const TOOLKIT_TABS: ReadonlyArray<ToolkitTab> = [
  'compass',
  'solar',
  'bio',
  'sos',
  'academy',
  'offline',
  'quiz',
];

function resolveToolkitTabFromUrl(): ToolkitTab {
  if (typeof window === 'undefined') return 'compass';
  const raw = new URLSearchParams(window.location.search).get('tab')?.trim().toLowerCase();
  if (raw === 'solar' || raw === 'bio' || raw === 'sos' || raw === 'offline' || raw === 'compass') {
    return raw;
  }
  if (raw === 'academy' || raw === 'drills') {
    return 'academy';
  }
  if (raw === 'quiz' || raw === 'topo' || raw === 'peak-quiz') {
    return 'quiz';
  }
  return 'compass';
}

interface SurvivalDrillOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

interface SurvivalDrillScenario {
  id: string;
  title: string;
  location: string;
  severity: 'critical' | 'urgent';
  situation: string;
  options: SurvivalDrillOption[];
  correctOptionId: 'A' | 'B' | 'C' | 'D';
  clinicalExplanation: string;
  forbiddenMistake: string;
  hotlineLabel: string;
  hotlinePhone: string;
}

const SURVIVAL_DRILLS_STORAGE_KEY = 'lost_survival_drills_v1';

const VIETNAM_SURVIVAL_DRILLS: SurvivalDrillScenario[] = [
  {
    id: 'drill-muidoi-heatstroke',
    title: 'Sốc Nhiệt Trên Đồi Cát Mũi Đôi (39°C)',
    location: 'Bán đảo Hòn Gốm, Vạn Ninh, Khánh Hòa',
    severity: 'critical',
    situation:
      '13:30 trên tiểu sa mạc đồi cát Đầm Môn, đồng đội dừng bước đột ngột, da đỏ nóng rực, ngưng đổ mồ hôi, nói năng lú lẫn và choáng váng nặng. Bạn cần ưu tiên xử trí bước nào đầu tiên?',
    options: [
      { id: 'A', text: 'Ép uống liền 1,5 lít nước lạnh thật nhanh và tiếp tục đi gấp tới Bãi Rạng.' },
      { id: 'B', text: 'Đưa vào bóng râm/dựng tăng che nắng ngay, cởi bớt lớp áo dày, làm mát tích cực bằng nước ướt + quạt gió vào cổ, nách, bẹn; chỉ cho nhấp từng ngụm nhỏ khi còn tỉnh táo và gọi cứu hộ.' },
      { id: 'C', text: 'Cho uống ngay 2 viên thuốc hạ sốt Paracetamol và bọc áo gió giữ ẩm.' },
      { id: 'D', text: 'Xoa dầu gió nóng khắp lưng và cạo gió cho ra mồ hôi.' },
    ],
    correctOptionId: 'B',
    clinicalExplanation:
      'Sốc nhiệt (Heat Stroke) có biểu hiện rối loạn tri giác và mất cơ chế tiết mồ hôi là tình trạng đe dọa tính mạng. Chuẩn WFA yêu cầu "Cool First, Transport Second": hạ nhiệt thân lõi khẩn cấp bằng cách tạo bóng râm, thấm ướt toàn thân kết hợp quạt đối lưu mạnh (tập trung vùng mạch lớn cổ–nách–bẹn) và sơ tán y tế ngay.',
    forbiddenMistake:
      'CẤM KỴ: Không dùng thuốc hạ sốt (Paracetamol/Ibuprofen không có tác dụng với sốc nhiệt và gây độc gan/thận khi mất nước), không xoa dầu nóng, không ép người lú lẫn uống nhiều nước gây sặc đường thở.',
    hotlineLabel: 'Cấp cứu 115 / Chi cục KL Khánh Hòa',
    hotlinePhone: '0258.3837.149',
  },
  {
    id: 'drill-fansipan-hypothermia',
    title: 'Hạ Thân Nhiệt Tại Đỉnh Fansipan (0°C, Gió Lạnh)',
    location: 'VQG Hoàng Liên, Sa Pa, Lào Cai (3.143m)',
    severity: 'critical',
    situation:
      'Mưa phùn kéo dài và gió 40 km/h gần mốc 2.800m. Một thành viên mặc áo cotton ướt sũng, run cầm cập không kiểm soát, phát âm chậm chạp và đánh rơi gậy trekking. Xử trí chuẩn WFA?',
    options: [
      { id: 'A', text: 'Cho uống một ngụm rượu ngô Tây Bắc để làm ấm cơ thể nhanh từ bên trong.' },
      { id: 'B', text: 'Chà xát thật mạnh tay chân nạn nhân để máu lưu thông nhanh trở lại.' },
      { id: 'C', text: 'Đưa vào chỗ kín gió/lều ngay, thay sạch quần áo ướt bằng đồ khô giữ nhiệt, cách ly khỏi mặt đất lạnh (tấm trải + túi ngủ), chườm ấm vùng trung tâm (ngực–cổ–bẹn) và cho uống nước ấm có đường nếu tỉnh táo.' },
      { id: 'D', text: 'Bắt chạy bộ tại chỗ 15 phút để cơ thể tự sinh nhiệt.' },
    ],
    correctOptionId: 'C',
    clinicalExplanation:
      'Hạ thân nhiệt mức độ vừa–nặng đòi hỏi chặn đứng mọi kênh mất nhiệt (gió, đồ ướt, dẫn nhiệt từ nền đất) bằng "Hypothermia Wrap": cởi đồ ẩm, mặc lớp len/lông vũ khô, lót cách nhiệt dưới lưng, làm ấm vùng thân lõi trước và bổ sung calo dễ hấp thu dạng nước ấm.',
    forbiddenMistake:
      'CẤM KỴ: Tuyệt đối không uống rượu bia (gây giãn mạch ngoại vi làm mất nhiệt lõi nhanh hơn), không xoa bóp mạnh tứ chi hoặc ngâm nước quá nóng (nguy cơ tụt huyết áp & rối loạn nhịp tim do máu lạnh đổ dồn về tim — Afterdrop).',
    hotlineLabel: 'BQL VQG Hoàng Liên (Sa Pa)',
    hotlinePhone: '02143.871.494',
  },
  {
    id: 'drill-cattien-snakebite',
    title: 'Rắn Lục Đuôi Đỏ Cắn Ở VQG Cát Tiên',
    location: 'Tuyến Bàu Sấu, VQG Cát Tiên, Đồng Nai',
    severity: 'critical',
    situation:
      'Trên lối mòn xuyên rừng vào Bàu Sấu, một trekker bị rắn lục đuôi đỏ (đầu tam giác, đuôi nâu đỏ) cắn vào cổ chân phải. Vết cắn sưng nề, đau nhói tăng nhanh. Xử trí sơ cứu chuẩn xác nhất?',
    options: [
      { id: 'A', text: 'Rạch chữ thập tại vết cắn, dùng miệng hút nọc độc ra ngoài rồi đắp lá rừng.' },
      { id: 'B', text: 'Buộc dây garo siết thật chặt trên đầu gối để chặn máu chảy về tim.' },
      { id: 'C', text: 'Giữ nạn nhân nằm yên bất động, tháo nhẫn/giày/tất trước khi sưng to, rửa nhẹ vết thương bằng nước sạch, nẹp cố định chi bị cắn thấp hơn mức tim và cáng khẩn cấp tới bệnh viện có huyết thanh kháng nọc.' },
      { id: 'D', text: 'Để nạn nhân tự đi bộ thật nhanh ra cổng VQG cho kịp giờ.' },
    ],
    correctOptionId: 'C',
    clinicalExplanation:
      'Nọc rắn lục đuôi đỏ gây rối loạn đông máu và hoại tử mô tại chỗ. Vận động mạnh làm bơm bạch huyết đẩy nọc lan nhanh toàn thân. Giữ bất động tuyệt đối, cố định chi thấp hơn tim, tháo bỏ trang sức/giày chật, theo dõi mốc thời gian + viền sưng và vận chuyển bằng cáng tới cơ sở y tế có huyết thanh là phác đồ sống còn.',
    forbiddenMistake:
      'CẤM KỴ: Không rạch da (gây chảy máu không cầm do độc tố đông máu), không hút nọc bằng miệng, không garo chặt (gây hoại tử phải cắt cụt chi), không chườm đá hay đắp thuốc nam.',
    hotlineLabel: 'BQL VQG Cát Tiên / Cấp cứu 115',
    hotlinePhone: '02513.669.228',
  },
  {
    id: 'drill-giengtroi-flashflood',
    title: 'Lũ Quét Đột Ngột Tại Suối Giếng Trời',
    location: 'Rừng Bà Nà – Hòa Vang, TP. Đà Nẵng',
    severity: 'critical',
    situation:
      'Đang nghỉ ăn trưa cạnh bờ đá suối Giếng Trời thì thấy nước suối đột ngột đục ngầu đỏ quạch, nổi nhiều bọt trắng, lá cây tươi trôi dạt và nghe tiếng ầm rền từ thượng nguồn dù tại chỗ chưa mưa to. Hành động đúng?',
    options: [
      { id: 'A', text: 'Tranh thủ thu gọn đầy đủ lều bạt, balo nặng rồi mới từ từ lội qua bờ bên kia.' },
      { id: 'B', text: 'Bỏ lại toàn bộ đồ nặng nếu cản trở, lập tức di chuyển vuông góc lên sườn đồi cao nhất cách xa lòng suối và tuyệt đối không cố lội ngược dòng hay vượt suối lúc nước đang lên.' },
      { id: 'C', text: 'Chạy xuôi theo lòng suối về hướng hạ lưu vì đường mòn bằng phẳng và dễ chạy hơn.' },
      { id: 'D', text: 'Trèo lên tảng đá lớn nằm giữa lòng suối để chờ nước rút.' },
    ],
    correctOptionId: 'B',
    clinicalExplanation:
      'Nước đục ngầu đột ngột, rác thực vật tươi và tiếng ầm thượng nguồn là 3 dấu hiệu vàng của lũ ống/lũ quét sắp ập tới trong vài chục giây đến vài phút. Nguyên tắc sinh tồn: tính mạng trên hết — leo thẳng vuông góc lên triền dốc cao vững chắc và chờ tối thiểu nhiều giờ sau khi nước rút hẳn.',
    forbiddenMistake:
      'CẤM KỴ: Không chạy dọc lòng suối (lũ quét di chuyển nhanh hơn người chạy 3–5 lần), không đứng trên đá giữa suối, không quay lại nhặt balo/thiết bị và không cố lội qua dòng nước đục sâu quá đầu gối.',
    hotlineLabel: 'Tổng đài CNCH Quốc gia 112 / 114',
    hotlinePhone: '112',
  },
  {
    id: 'drill-taxua-lightning',
    title: 'Giông Sét Trên Sống Lưng Khủng Long Tà Xùa',
    location: 'Trạm Tấu (Yên Bái) / Bắc Yên (Sơn La) — 2.865m',
    severity: 'critical',
    situation:
      '15:00 trên sống núi trống trải không có nhà kiên cố, mây đen kéo tới nhanh, khoảng cách giữa tia chớp và tiếng sấm rút ngắn dưới 15 giây, tóc bắt đầu dựng đứng và gậy kim loại kêu rè nhẹ. Xử trí khẩn cấp?',
    options: [
      { id: 'A', text: 'Chạy ngay vào đứng trú dưới gốc cây cổ thụ cao nhất mọc đơn độc bên sườn núi.' },
      { id: 'B', text: 'Nằm bẹp sát toàn thân xuống mặt đất để giảm chiều cao tối đa.' },
      { id: 'C', text: 'Lập tức rời đỉnh/sống lưng cao xuống sườn thấp hơn, bỏ gậy trekking/vật kim loại cách xa 15m, cả đoàn tản cách nhau tối thiểu 10–15m, ngồi xổm tư thế Lightning Squat trên tấm cách nhiệt/balo khô, hai bàn chân chụm sát nhau.' },
      { id: 'D', text: 'Cả đoàn đứng sát vòng tròn ôm nhau cho ấm và đỡ sợ.' },
    ],
    correctOptionId: 'C',
    clinicalExplanation:
      'Quy tắc 30–30: khi thời gian từ chớp tới sấm <= 30 giây, sét đã ở trong bán kính nguy hiểm (<10 km). Rời ngay đường sống núi cao, tản đội hình để tránh thương vong hàng loạt do dòng điện mặt đất (Ground Current), đặt chân chụm sát để triệt tiêu điện áp bước và chỉ tiếp xúc đất tối thiểu qua đệm cách điện.',
    forbiddenMistake:
      'CẤM KỴ: Không nằm dài xuống đất (tăng diện tích dẫn dòng điện mặt đất đi qua tim), không trú dưới cây đơn độc hoặc vách hang nông, không tụm đông sát nhau và không cầm gậy kim loại/dựng khung lều nhôm.',
    hotlineLabel: 'Chi cục Kiểm lâm Yên Bái / CNCH 112',
    hotlinePhone: '02163.852.341',
  },
  {
    id: 'drill-kyquansan-lost',
    title: 'Lạc Đường Trong Sương Mù Đặc Kỳ Quan San',
    location: 'Bát Xát, Lào Cai (3.046m — Sàng Ma Sáo)',
    severity: 'urgent',
    situation:
      '16:40 sương mù dày tầm nhìn dưới 10m, trời sắp tối, không thấy dấu sơn chỉ đường và bạn không chắc hướng quay về Lán Núi Muối. Quy trình chuẩn S.T.O.P là gì?',
    options: [
      { id: 'A', text: 'Cố gắng đi thật nhanh xuống các khe suối sâu vì nước suối luôn chảy về bản làng.' },
      { id: 'B', text: 'S-T-O-P: Dừng lại ngay tại vị trí an toàn kín gió trước khi trời tối, bình tĩnh quan sát GPS/bản đồ Offline, thổi còi 3 hồi ngắn định kỳ, mặc đủ lớp giữ ấm, gửi SMS 2G kèm tọa độ WGS84 về 112 và ở nguyên một chỗ chờ cứu hộ.' },
      { id: 'C', text: 'Tách từng người trong nhóm đi tỏa ra 3 hướng khác nhau tìm đường mòn rồi hú gọi nhau.' },
      { id: 'D', text: 'Đốt lửa lớn ngay giữa rừng trúc khô để tạo cột khói cầu cứu.' },
    ],
    correctOptionId: 'B',
    clinicalExplanation:
      'Hầu hết các ca lạc rừng tử vong tại Việt Nam xảy ra khi nạn nhân hoảng loạn di chuyển trong đêm tối hoặc tụt xuống khe suối dốc đá trơn trượt. Ở yên tại điểm an toàn, giữ ấm chống hạ thân nhiệt, dùng còi 3.1kHz (tín hiệu 3 hồi) và gửi SMS 2G tọa độ giúp lực lượng kiểm lâm khoanh vùng cứu hộ cực nhanh.',
    forbiddenMistake:
      'CẤM KỴ: Không đi xuống khe suối cạn/thác đá (địa hình hiểm trở, mất sóng hoàn toàn, dễ trượt ngã), không tách đoàn và không di chuyển mò mẫm sau khi trời tối hẳn.',
    hotlineLabel: 'Chi cục Kiểm lâm Lào Cai / 112',
    hotlinePhone: '02163.852.341',
  },
  {
    id: 'drill-pusilung-ams',
    title: 'Say Độ Cao Nặng (AMS / HAPE) Trên Pu Si Lung 3.083m',
    location: 'Xã Pa Vệ Sử, Mường Tè, Lai Châu (3.083m)',
    severity: 'critical',
    situation:
      'Đêm thứ hai ở độ cao gần 2.900m, thành viên đau đầu dữ dội không giảm sau khi uống thuốc giảm đau, nôn ói liên tục, đi loạng choạng như say rượu và ho khạc bọt hồng kèm khó thở ngay cả khi nằm nghỉ. Xử trí tối thượng?',
    options: [
      { id: 'A', text: 'Cho nằm yên trong lều ngủ một giấc tới sáng xem có tự hết không.' },
      { id: 'B', text: 'Cho uống nhiều trà gừng đặc và sáng hôm sau cố leo nốt lên đỉnh 3.083m rồi mới xuống.' },
      { id: 'C', text: 'Nhận diện dấu hiệu phù phổi / phù não độ cao (HAPE/HACE) đe dọa tính mạng: lập tức HẠ ĐỘ CAO ngay ít nhất 300–500m (có người dìu/cáng, giữ ấm, đầu cao hơn thân) kể cả trong đêm khi an toàn di chuyển và kích hoạt cứu hộ khẩn cấp.' },
      { id: 'D', text: 'Cho uống thuốc ngủ để nạn nhân nghỉ ngơi sâu hơn.' },
    ],
    correctOptionId: 'C',
    clinicalExplanation:
      'Mất thăng bằng (Ataxia), lú lẫn (HACE) hoặc khó thở khi nghỉ, ho bọt hồng (HAPE) là biến chứng độ cao nguy kịch. Quy tắc vàng của Y học Núi cao (WMS): "Descent is the definitive treatment" — chỉ có hạ cao độ lập tức mới cứu sống bệnh nhân.',
    forbiddenMistake:
      'CẤM KỴ: Tuyệt đối không tiếp tục leo cao hơn khi có triệu chứng AMS, không để bệnh nhân ngủ qua đêm chờ sáng khi đã có dấu hiệu HAPE/HACE và CẤM dùng thuốc ngủ/an thần (làm ức chế hô hấp nghiêm trọng hơn).',
    hotlineLabel: 'Chi cục Kiểm lâm Lai Châu / 112',
    hotlinePhone: '02133.876.605',
  },
  {
    id: 'drill-taynguyen-anaphylaxis',
    title: 'Sốc Phản Vệ Ong Vò Vẽ & Vết Vắt Rừng Tây Nguyên',
    location: 'VQG Bidoup – Núi Bà / Chư Yang Sin (Tây Nguyên)',
    severity: 'critical',
    situation:
      'Sau khi bị 3 con ong vò vẽ rừng đốt ở cổ và cánh tay, một thành viên sau 8 phút bắt đầu nổi mề đay toàn thân, sưng môi mắt, khàn tiếng, thở rít và chóng mặt tụt huyết áp. Bạn phải làm gì ngay?',
    options: [
      { id: 'A', text: 'Chờ theo dõi thêm 30 phút và bôi vôi hoặc kem đánh răng lên nốt đốt.' },
      { id: 'B', text: 'Khẩn cấp tiêm bắp Adrenaline (EpiPen vào mặt ngoài đùi) nếu đoàn có mang theo, đặt nạn nhân nằm ngửa nâng cao chân (hoặc ngồi nửa nằm nếu khó thở), nới lỏng quần áo, gạt ngòi nhẹ nhàng, gọi 115/BQL VQG và sơ tán cấp cứu ngay.' },
      { id: 'C', text: 'Đứng dậy đi lại thật nhanh để tim đập mạnh chống tụt huyết áp.' },
      { id: 'D', text: 'Dùng nhíp bóp mạnh túi nọc ong để rút nọc ra hết.' },
    ],
    correctOptionId: 'B',
    clinicalExplanation:
      'Sưng đường thở, khàn tiếng, thở rít và tụt huyết áp sau khi bị ong đốt là Sốc phản vệ độ III–IV. Adrenaline tiêm bắp (mặt ngoài đùi) là thuốc cứu mạng duy nhất đầu tay. Duy trì tư thế nằm nâng chân (không để đứng dậy đột ngột gây trụy mạch), sẵn sàng liều nhắc sau 5–15 phút nếu triệu chứng không cải thiện và vận chuyển cấp cứu ngay.',
    forbiddenMistake:
      'CẤM KỴ: Không bắt nạn nhân sốc phản vệ đứng dậy hay tự đi bộ (nguy cơ ngừng tim đột ngột do tụt huyết áp tư thế), không bóp túi nọc bằng nhíp (bơm thêm nọc vào da) và không dùng thuốc kháng histamin uống thay thế cho Adrenaline.',
    hotlineLabel: 'VQG Bidoup - Núi Bà / Cấp cứu 115',
    hotlinePhone: '0263.3502.005',
  },
];

function loadSavedDrillAnswers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SURVIVAL_DRILLS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { answers?: Record<string, string> };
    return parsed && typeof parsed.answers === 'object' && parsed.answers !== null ? parsed.answers : {};
  } catch {
    return {};
  }
}

function saveDrillAnswers(answers: Record<string, string>) {
  try {
    localStorage.setItem(
      SURVIVAL_DRILLS_STORAGE_KEY,
      JSON.stringify({ answers, updatedAt: new Date().toISOString() })
    );
  } catch {
    // ignore storage errors
  }
}

interface GpsLockState {
  lat: number;
  lng: number;
  altitudeM: number | null;
  accuracyM: number | null;
  timestamp: number;
}

interface DeviceOrientationEventWithPermission extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface MorseElement {
  on: boolean;
  ms: number;
  symbolIndex: number;
}

// Standard international Morse SOS: ... --- ... (unit = 180ms)
const MORSE_UNIT_MS = 180;
const MORSE_SOS_PATTERN: MorseElement[] = [
  // S: dot dot dot
  { on: true, ms: MORSE_UNIT_MS, symbolIndex: 0 },
  { on: false, ms: MORSE_UNIT_MS, symbolIndex: 0 },
  { on: true, ms: MORSE_UNIT_MS, symbolIndex: 1 },
  { on: false, ms: MORSE_UNIT_MS, symbolIndex: 1 },
  { on: true, ms: MORSE_UNIT_MS, symbolIndex: 2 },
  { on: false, ms: MORSE_UNIT_MS * 3, symbolIndex: 2 },
  // O: dash dash dash
  { on: true, ms: MORSE_UNIT_MS * 3, symbolIndex: 3 },
  { on: false, ms: MORSE_UNIT_MS, symbolIndex: 3 },
  { on: true, ms: MORSE_UNIT_MS * 3, symbolIndex: 4 },
  { on: false, ms: MORSE_UNIT_MS, symbolIndex: 4 },
  { on: true, ms: MORSE_UNIT_MS * 3, symbolIndex: 5 },
  { on: false, ms: MORSE_UNIT_MS * 3, symbolIndex: 5 },
  // S: dot dot dot
  { on: true, ms: MORSE_UNIT_MS, symbolIndex: 6 },
  { on: false, ms: MORSE_UNIT_MS, symbolIndex: 6 },
  { on: true, ms: MORSE_UNIT_MS, symbolIndex: 7 },
  { on: false, ms: MORSE_UNIT_MS, symbolIndex: 7 },
  { on: true, ms: MORSE_UNIT_MS, symbolIndex: 8 },
  { on: false, ms: MORSE_UNIT_MS * 7, symbolIndex: -1 },
];

const SOS_QUICK_NOTES = [
  'Bi lac duong trong rung, can xac dinh huong va ho tro.',
  'Chan thuong chan, khong the tu di chuyen xuong nui.',
  'Co dau hieu soc do cao AMS (dau dau, non, kho tho).',
  'Ha than nhiet do mua gio lanh, can cuu ho khan cap.',
  'Can nuoc va kiet suc, dang o diem dung an toan.',
];

const CLOUD_CHECKLIST_ITEMS = [
  {
    id: 'humidity',
    title: 'Độ ẩm không khí ban đêm >= 85%',
    detail: 'Không khí ẩm vùng thung lũng tích tụ thành tầng mây đặc từ 01:00–05:00 sáng.',
  },
  {
    id: 'wind',
    title: 'Gió trên sống lưng / đỉnh < 20 km/h',
    detail: 'Gió nhẹ giữ biển mây nằm êm dưới thung lũng, không bị thổi tan hay cuộn mù.',
  },
  {
    id: 'rain',
    title: 'Mưa tạnh trước 02:00 sáng (không bão/áp thấp)',
    detail: 'Cơn mưa nhẹ chiều hôm trước giúp tăng hơi ẩm, sau đó trời quang tạo biển mây dày.',
  },
  {
    id: 'inversion',
    title: 'Nghịch nhiệt ngày – đêm chênh >= 7°C',
    detail: 'Đêm lạnh dưới 12°C, sáng có nắng hửng giúp tạo ranh giới mây sắc nét dưới chân đỉnh.',
  },
  {
    id: 'arrival',
    title: 'Có mặt tại điểm ngắm trước giờ Bình minh Dân dụng',
    detail: 'Xuất phát từ lán sớm 45–60 phút để đón trọn dải ánh sáng Giờ Xanh & Giờ Vàng.',
  },
];

const IconCrosshairSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="22" y1="12" x2="18" y2="12" />
    <line x1="6" y1="12" x2="2" y2="12" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="12" y1="22" x2="12" y2="18" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const IconFlashlightSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconVolumeSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

function extractPrimaryDialNumber(rawPhone: string): string {
  const firstSegment = String(rawPhone || '').split(/[/|,;()]/)[0] || '';
  const digits = firstSegment.replace(/[^0-9+]/g, '');
  return digits.length >= 3 ? digits : '112';
}

function getTodayVietnamIso(): string {
  const vnNow = new Date(Date.now() + 7 * 3_600_000);
  const y = vnNow.getUTCFullYear();
  const m = String(vnNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vnNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentVietnamDecimalHour(): number {
  const vnNow = new Date(Date.now() + 7 * 3_600_000);
  return Math.round((vnNow.getUTCHours() + vnNow.getUTCMinutes() / 60) * 12) / 12;
}

function formatDayLengthVi(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}g ${String(m).padStart(2, '0')}p`;
}

function getAccuracyMeta(accuracyM: number | null): { label: string; badgeClass: string } {
  if (accuracyM === null) return { label: 'Chưa khóa GPS', badgeClass: 'badge-cloud' };
  if (accuracyM <= 15) return { label: `Rất chính xác (±${Math.round(accuracyM)}m)`, badgeClass: 'badge-success' };
  if (accuracyM <= 50) return { label: `Độ chính xác khá (±${Math.round(accuracyM)}m)`, badgeClass: 'badge-sun' };
  return { label: `Tín hiệu yếu (±${Math.round(accuracyM)}m)`, badgeClass: 'badge-error' };
}

export const FieldToolkitView: React.FC<FieldToolkitViewProps> = ({
  trails,
  initialTrailId,
  onSelectTrail,
  onShowToast,
  onBack,
}) => {
  const svgUid = useId().replace(/:/g, '');
  const [activeTab, setActiveTab] = useState<ToolkitTab>(resolveToolkitTabFromUrl);
  const { trackRef: toolkitTabTrackRef, indicatorStyle: toolkitTabIndicatorStyle } =
    useSlidingIndicator<ToolkitTab>(activeTab);
  const isMountedRef = useRef<boolean>(true);
  const lastSyncedTrailIdRef = useRef<string | undefined>(initialTrailId);
  const tabButtonRefs = useRef<Partial<Record<ToolkitTab, HTMLButtonElement | null>>>({});

  const handleSelectTab = useCallback((nextTab: ToolkitTab) => {
    setActiveTab(nextTab);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const urlTabValue = nextTab === 'quiz' ? 'peak-quiz' : nextTab;
      if (url.searchParams.get('tab') !== urlTabValue) {
        url.searchParams.set('tab', urlTabValue);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // Ignore malformed URL environments
    }
  }, []);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIdx = (currentIdx + 1) % TOOLKIT_TABS.length;
      } else if (e.key === 'ArrowLeft') {
        nextIdx = (currentIdx - 1 + TOOLKIT_TABS.length) % TOOLKIT_TABS.length;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else if (e.key === 'End') {
        nextIdx = TOOLKIT_TABS.length - 1;
      }
      if (nextIdx === null) return;
      e.preventDefault();
      const targetTab = TOOLKIT_TABS[nextIdx];
      handleSelectTab(targetTab);
      tabButtonRefs.current[targetTab]?.focus();
    },
    [handleSelectTab]
  );

  const handleOpenTrailFromQuiz = useCallback(
    (trail: Trail) => {
      if (onSelectTrail) {
        onSelectTrail(trail);
        return;
      }
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', `/trails/${encodeURIComponent(trail.id)}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    },
    [onSelectTrail]
  );

  useEffect(() => {
    isMountedRef.current = true;
    const handlePop = () => {
      setActiveTab(resolveToolkitTabFromUrl());
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('popstate', handlePop);
    };
  }, []);

  // Resolve initial trail safely (defaults to Fansipan or first trail)
  const initialTrail = useMemo(() => {
    if (initialTrailId) {
      const matched = trails.find((t) => t.id === initialTrailId);
      if (matched) return matched;
    }
    return trails.find((t) => t.id === 'trail-fansipan') || trails[0] || null;
  }, [trails, initialTrailId]);

  // =========================================================================
  // TAB 1: COMPASS, GPS LOCK, WGS84 <-> DMS & BEARING CALCULATOR
  // =========================================================================
  const [headingDeg, setHeadingDeg] = useState<number>(38);
  const [compassMode, setCompassMode] = useState<'manual' | 'sensor'>('manual');
  const [sensorStatus, setSensorStatus] = useState<string>('Chế độ chỉnh tay (Desktop / Mô phỏng)');

  const [gpsLock, setGpsLock] = useState<GpsLockState | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const defaultLat = initialTrail?.endLat ?? 22.3033;
  const defaultLng = initialTrail?.endLng ?? 103.775;

  const [decLat, setDecLat] = useState<string>(defaultLat.toFixed(6));
  const [decLng, setDecLng] = useState<string>(defaultLng.toFixed(6));

  const initLatDms = decimalToDms(defaultLat, true);
  const initLngDms = decimalToDms(defaultLng, false);
  const [latDeg, setLatDeg] = useState<string>(String(initLatDms.degrees));
  const [latMin, setLatMin] = useState<string>(String(initLatDms.minutes));
  const [latSec, setLatSec] = useState<string>(initLatDms.seconds.toFixed(1));
  const [latDir, setLatDir] = useState<CardinalHemisphere>(initLatDms.direction);

  const [lngDeg, setLngDeg] = useState<string>(String(initLngDms.degrees));
  const [lngMin, setLngMin] = useState<string>(String(initLngDms.minutes));
  const [lngSec, setLngSec] = useState<string>(initLngDms.seconds.toFixed(1));
  const [lngDir, setLngDir] = useState<CardinalHemisphere>(initLngDms.direction);

  // Two-point Azimuth Bearing & Distance state
  const [originLat, setOriginLat] = useState<string>((initialTrail?.startLat ?? 22.3522).toFixed(6));
  const [originLng, setOriginLng] = useState<string>((initialTrail?.startLng ?? 103.7769).toFixed(6));
  const [targetTrailId, setTargetTrailId] = useState<string>(initialTrail?.id || 'trail-fansipan');
  const [targetLat, setTargetLat] = useState<string>(defaultLat.toFixed(6));
  const [targetLng, setTargetLng] = useState<string>(defaultLng.toFixed(6));

  // Altimeter & Atmospheric Physics (ISA Troposphere + Boiling Point)
  const [physicsTrailId, setPhysicsTrailId] = useState<string>(initialTrail?.id || 'trail-fansipan');
  const [physicsAltM, setPhysicsAltM] = useState<number>(
    Math.max(0, Math.min(3200, initialTrail?.maxAltitudeM ?? 3143))
  );
  const [physicsBaseTempC, setPhysicsBaseTempC] = useState<number>(26);
  const [physicsSourceLabel, setPhysicsSourceLabel] = useState<string>(
    initialTrail ? initialTrail.name : 'Đỉnh Fansipan'
  );
  const syncAltimeterOnGpsRef = useRef<boolean>(false);

  const altitudePhysics = useMemo(
    () => computeAltitudePhysics(physicsAltM, physicsBaseTempC),
    [physicsAltM, physicsBaseTempC]
  );

  const physicsBenchmarks = useMemo(
    () =>
      ISA_VIETNAM_BENCHMARKS.map((bm) => ({
        ...bm,
        metrics: computeAltitudePhysics(bm.altitudeM, physicsBaseTempC),
      })),
    [physicsBaseTempC]
  );

  // Sync converter from Decimal -> DMS
  const applyDecimalCoords = (latVal: number, lngVal: number) => {
    setDecLat(latVal.toFixed(6));
    setDecLng(lngVal.toFixed(6));
    const dLat = decimalToDms(latVal, true);
    const dLng = decimalToDms(lngVal, false);
    setLatDeg(String(dLat.degrees));
    setLatMin(String(dLat.minutes));
    setLatSec(dLat.seconds.toFixed(1));
    setLatDir(dLat.direction);
    setLngDeg(String(dLng.degrees));
    setLngMin(String(dLng.minutes));
    setLngSec(dLng.seconds.toFixed(1));
    setLngDir(dLng.direction);
  };

  const handleDecimalLatInput = (raw: string) => {
    setDecLat(raw);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= -90 && parsed <= 90) {
      const d = decimalToDms(parsed, true);
      setLatDeg(String(d.degrees));
      setLatMin(String(d.minutes));
      setLatSec(d.seconds.toFixed(1));
      setLatDir(d.direction);
    }
  };

  const handleDecimalLngInput = (raw: string) => {
    setDecLng(raw);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= -180 && parsed <= 180) {
      const d = decimalToDms(parsed, false);
      setLngDeg(String(d.degrees));
      setLngMin(String(d.minutes));
      setLngSec(d.seconds.toFixed(1));
      setLngDir(d.direction);
    }
  };

  const handleDmsLatChange = (dStr: string, mStr: string, sStr: string, dir: CardinalHemisphere) => {
    setLatDeg(dStr);
    setLatMin(mStr);
    setLatSec(sStr);
    setLatDir(dir);
    const dec = dmsToDecimal(Number(dStr) || 0, Number(mStr) || 0, Number(sStr) || 0, dir);
    setDecLat(dec.toFixed(6));
  };

  const handleDmsLngChange = (dStr: string, mStr: string, sStr: string, dir: CardinalHemisphere) => {
    setLngDeg(dStr);
    setLngMin(mStr);
    setLngSec(sStr);
    setLngDir(dir);
    const dec = dmsToDecimal(Number(dStr) || 0, Number(mStr) || 0, Number(sStr) || 0, dir);
    setDecLng(dec.toFixed(6));
  };

  // DeviceOrientation compass listener
  useEffect(() => {
    if (compassMode !== 'sensor') return;

    const handleOrientation = (ev: Event) => {
      const e = ev as DeviceOrientationEventWithPermission;
      if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
        setHeadingDeg(Math.round(e.webkitCompassHeading));
        setSensorStatus('Cảm biến từ kế iOS đang hoạt động');
      } else if (typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
        const heading = (360 - e.alpha) % 360;
        setHeadingDeg(Math.round(heading < 0 ? heading + 360 : heading));
        setSensorStatus('Cảm biến la bàn thiết bị đang hoạt động');
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [compassMode]);

  const handleToggleCompassSensor = async () => {
    if (compassMode === 'sensor') {
      setCompassMode('manual');
      setSensorStatus('Đã chuyển sang chế độ chỉnh tay');
      return;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorStatus('Thiết bị không có cảm biến la bàn — dùng thanh trượt để định hướng.');
      onShowToast?.('Trình duyệt máy tính không hỗ trợ cảm biến từ kế. Hãy dùng thanh xoay góc thủ công.', 'info');
      return;
    }

    try {
      const OrientationCtor = window.DeviceOrientationEvent as unknown as DeviceOrientationConstructorWithPermission;
      if (typeof OrientationCtor.requestPermission === 'function') {
        const permission = await OrientationCtor.requestPermission();
        if (permission !== 'granted') {
          setSensorStatus('Người dùng từ chối quyền truy cập cảm biến hướng.');
          onShowToast?.('Chưa cấp quyền cảm biến La bàn trên iOS.', 'error');
          return;
        }
      }
      setCompassMode('sensor');
      setSensorStatus('Đang chờ tín hiệu từ kế (xoay điện thoại hình số 8 để hiệu chuẩn)...');
    } catch {
      setSensorStatus('Không thể kích hoạt cảm biến hướng — chuyển sang chế độ thủ công.');
      onShowToast?.('Không thể bật cảm biến hướng trên thiết bị này.', 'error');
    }
  };

  // Live GPS lock (shared by Tab 1 & Tab 4)
  const handleLockGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const msg = 'Thiết bị không hỗ trợ định vị GPS (Geolocation API).';
      setGpsError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        const lock: GpsLockState = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          altitudeM:
            typeof pos.coords.altitude === 'number' && Number.isFinite(pos.coords.altitude)
              ? Math.round(pos.coords.altitude)
              : null,
          accuracyM:
            typeof pos.coords.accuracy === 'number' && Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy)
              : null,
          timestamp: pos.timestamp || Date.now(),
        };
        setGpsLock(lock);
        setGpsLoading(false);
        applyDecimalCoords(lock.lat, lock.lng);
        setOriginLat(lock.lat.toFixed(6));
        setOriginLng(lock.lng.toFixed(6));
        const shouldSyncAltimeter = syncAltimeterOnGpsRef.current;
        syncAltimeterOnGpsRef.current = false;
        if (shouldSyncAltimeter) {
          if (lock.altitudeM !== null) {
            const clampedAlt = Math.max(0, Math.min(3200, lock.altitudeM));
            setPhysicsTrailId('');
            setPhysicsAltM(clampedAlt);
            setPhysicsSourceLabel('Cao độ GPS thực tế');
            onShowToast?.(
              `Đã khóa GPS và đồng bộ cao độ ${clampedAlt.toLocaleString('vi-VN')}m vào bảng vật lý ISA.`,
              'success'
            );
          } else {
            onShowToast?.(
              `Đã khóa tọa độ GPS (±${lock.accuracyM ?? '?'}m), nhưng thiết bị chưa trả về cao độ vệ tinh. Hãy chọn đỉnh hoặc kéo thanh cao độ.`,
              'info'
            );
          }
        } else {
          onShowToast?.(`Đã khóa tọa độ GPS (±${lock.accuracyM ?? '?'}m).`, 'success');
        }
      },
      (err) => {
        if (!isMountedRef.current) return;
        syncAltimeterOnGpsRef.current = false;
        setGpsLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Trình duyệt đang chặn quyền GPS. Hãy bật Vị trí trong Cài đặt.'
            : err.code === err.TIMEOUT
              ? 'Quá thời gian bắt sóng vệ tinh GPS — hãy di chuyển ra khoảng thoáng.'
              : 'Không thể xác định tọa độ GPS lúc này.';
        setGpsError(msg);
        onShowToast?.(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 }
    );
  };

  const bearingMetrics = useMemo(() => {
    const lat1 = Number(originLat);
    const lng1 = Number(originLng);
    const lat2 = Number(targetLat);
    const lng2 = Number(targetLng);
    if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(v))) {
      return { distanceKm: 0, forwardDeg: 0, backDeg: 180, sector: 'Bắc (N)' };
    }
    const distanceKm = calculateHaversineKm(lat1, lng1, lat2, lng2);
    const forwardDeg = calculateBearingDeg(lat1, lng1, lat2, lng2);
    const backDeg = Math.round(((forwardDeg + 180) % 360) * 10) / 10;
    return {
      distanceKm,
      forwardDeg,
      backDeg,
      sector: getCardinalDirectionLabel(forwardDeg),
    };
  }, [originLat, originLng, targetLat, targetLng]);

  const handleSelectTargetTrail = (tid: string) => {
    setTargetTrailId(tid);
    const tr = trails.find((t) => t.id === tid);
    if (tr) {
      setTargetLat(tr.endLat.toFixed(6));
      setTargetLng(tr.endLng.toFixed(6));
    }
  };

  // =========================================================================
  // TAB 2: NOAA SOLAR CALCULATOR, GOLDEN HOUR & SEA-OF-CLOUDS CHECKLIST
  // =========================================================================
  const [solarTrailId, setSolarTrailId] = useState<string>(initialTrail?.id || 'custom');
  const [solarLat, setSolarLat] = useState<string>(defaultLat.toFixed(5));
  const [solarLng, setSolarLng] = useState<string>(defaultLng.toFixed(5));
  const [solarAltitudeM, setSolarAltitudeM] = useState<number>(initialTrail?.maxAltitudeM ?? 3143);
  const [solarDateIso, setSolarDateIso] = useState<string>(getTodayVietnamIso);
  const [solarInspectHour, setSolarInspectHour] = useState<number>(getCurrentVietnamDecimalHour);
  const [cloudChecks, setCloudChecks] = useState<Record<string, boolean>>({
    humidity: true,
    wind: true,
    rain: false,
    inversion: true,
    arrival: false,
  });

  const selectedSolarTrail = useMemo(
    () => trails.find((t) => t.id === solarTrailId) || null,
    [trails, solarTrailId]
  );

  const handleSelectSolarTrail = (tid: string) => {
    setSolarTrailId(tid);
    const tr = trails.find((t) => t.id === tid);
    if (tr) {
      setSolarLat(tr.endLat.toFixed(5));
      setSolarLng(tr.endLng.toFixed(5));
      setSolarAltitudeM(tr.maxAltitudeM);
    }
  };

  const solarData = useMemo(() => {
    const [yStr, mStr, dStr] = solarDateIso.split('-');
    const year = Number(yStr) || 2026;
    const month = (Number(mStr) || 1) - 1;
    const day = Number(dStr) || 1;
    const hh = Math.floor(solarInspectHour);
    const mm = Math.round((solarInspectHour - hh) * 60);
    // Construct UTC Date corresponding to Vietnam UTC+7 local time
    const targetDate = new Date(Date.UTC(year, month, day, hh - 7, mm, 0));
    const latNum = Number(solarLat);
    const lngNum = Number(solarLng);
    return calculateSolarTimes(
      Number.isFinite(latNum) ? latNum : 22.3033,
      Number.isFinite(lngNum) ? lngNum : 103.775,
      targetDate,
      7
    );
  }, [solarDateIso, solarInspectHour, solarLat, solarLng]);

  const sunriseCountdownLabel = useMemo(() => {
    const diffHours = solarData.sunriseHours - solarInspectHour;
    if (Math.abs(diffHours) < 0.08) return 'Đúng khoảnh khắc Mặt Trời mọc!';
    if (diffHours > 0) {
      return `Còn ${formatDayLengthVi(Math.round(diffHours * 60))} tới Bình minh (${solarData.sunrise})`;
    }
    const nextSunriseDiff = 24 - solarInspectHour + solarData.sunriseHours;
    return `Đã qua bình minh — Bình minh kế tiếp sau ${formatDayLengthVi(Math.round(nextSunriseDiff * 60))}`;
  }, [solarData.sunrise, solarData.sunriseHours, solarInspectHour]);

  const cloudReadinessScore = useMemo(() => {
    const checkedCount = CLOUD_CHECKLIST_ITEMS.filter((item) => cloudChecks[item.id]).length;
    const checklistPoints = (checkedCount / CLOUD_CHECKLIST_ITEMS.length) * 65;
    const altitudePoints = solarAltitudeM >= 2200 ? 25 : solarAltitudeM >= 1600 ? 20 : solarAltitudeM >= 1000 ? 12 : 5;
    const monthNum = Number(solarDateIso.split('-')[1]) || 1;
    const seasonPoints = selectedSolarTrail
      ? selectedSolarTrail.bestMonths.includes(monthNum)
        ? 10
        : selectedSolarTrail.avoidMonths.includes(monthNum)
          ? 2
          : 6
      : [10, 11, 12, 1, 2, 3, 4].includes(monthNum)
        ? 10
        : 5;
    return Math.min(100, Math.round(checklistPoints + altitudePoints + seasonPoints));
  }, [cloudChecks, solarAltitudeM, solarDateIso, selectedSolarTrail]);

  // =========================================================================
  // TAB 3: HYDRATION, CALORIES & PACK WEIGHT (POST /api/ai/bio-calc + OFFLINE)
  // =========================================================================
  const [bioTrailId, setBioTrailId] = useState<string>(initialTrail?.id || 'custom');
  const [bioDistanceKm, setBioDistanceKm] = useState<number>(initialTrail?.distanceKm ?? 22.4);
  const [bioGainM, setBioGainM] = useState<number>(initialTrail?.elevationGainM ?? 1380);
  const [bioMaxAltM, setBioMaxAltM] = useState<number>(initialTrail?.maxAltitudeM ?? 3143);
  const [bioDays, setBioDays] = useState<number>(initialTrail?.durationDays ?? 2);
  const [bioBodyWeightKg, setBioBodyWeightKg] = useState<number>(62);
  const [bioPackWeightKg, setBioPackWeightKg] = useState<number>(9.5);
  const [bioTempC, setBioTempC] = useState<number>(initialTrail && initialTrail.maxAltitudeM >= 2400 ? 15 : 23);
  const [bioFitness, setBioFitness] = useState<AiFitnessLevel>('intermediate');
  const [serverBioResult, setServerBioResult] = useState<BioCalcResult | null>(null);
  const [bioSource, setBioSource] = useState<'offline' | 'server'>('offline');
  const [bioSyncing, setBioSyncing] = useState<boolean>(false);

  const selectedBioTrail = useMemo(
    () => trails.find((t) => t.id === bioTrailId) || null,
    [trails, bioTrailId]
  );

  const handleSelectBioTrail = (tid: string) => {
    setBioTrailId(tid);
    const tr = trails.find((t) => t.id === tid);
    if (tr) {
      setBioDistanceKm(tr.distanceKm);
      setBioGainM(tr.elevationGainM);
      setBioMaxAltM(tr.maxAltitudeM);
      setBioDays(tr.durationDays || 1);
      setBioTempC(tr.maxAltitudeM >= 2400 ? 15 : tr.maxAltitudeM >= 1400 ? 21 : 27);
      setBioSource('offline');
      setServerBioResult(null);
    }
  };

  const offlineBioMetrics = useMemo<BioCalcResult>(
    () =>
      computeClientBioMetrics({
        trailName: selectedBioTrail?.name || 'Cung tự nhập',
        distanceKm: bioDistanceKm,
        elevationGainM: bioGainM,
        elevationLossM: bioGainM,
        maxAltitudeM: bioMaxAltM,
        bodyWeightKg: bioBodyWeightKg,
        packWeightKg: bioPackWeightKg,
        fitnessLevel: bioFitness,
        ambientTempC: bioTempC,
        durationDays: bioDays,
      }),
    [
      selectedBioTrail?.name,
      bioDistanceKm,
      bioGainM,
      bioMaxAltM,
      bioBodyWeightKg,
      bioPackWeightKg,
      bioFitness,
      bioTempC,
      bioDays,
    ]
  );

  const activeBioMetrics = bioSource === 'server' && serverBioResult ? serverBioResult : offlineBioMetrics;

  // Debounced online sync with POST /api/ai/bio-calc (seamless offline fallback)
  useEffect(() => {
    if (activeTab !== 'bio') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setBioSyncing(true);
        const res = await fetch('/api/ai/bio-calc', {
          method: 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          signal: controller.signal,
          body: JSON.stringify({
            trailId: selectedBioTrail?.id,
            trailName: selectedBioTrail?.name || 'Cung tự nhập',
            distanceKm: bioDistanceKm,
            elevationGainM: bioGainM,
            elevationLossM: bioGainM,
            maxAltitudeM: bioMaxAltM,
            bodyWeightKg: bioBodyWeightKg,
            packWeightKg: bioPackWeightKg,
            fitnessLevel: bioFitness,
            ambientTempC: bioTempC,
            durationDays: bioDays,
          }),
        });
        if (controller.signal.aborted || !isMountedRef.current) return;
        if (!res.ok) {
          setBioSource('offline');
          return;
        }
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: BioCalcResult } | null;
        if (controller.signal.aborted || !isMountedRef.current) return;
        if (json?.success && json.data) {
          setServerBioResult(json.data);
          setBioSource('server');
        } else {
          setBioSource('offline');
        }
      } catch {
        if (controller.signal.aborted || !isMountedRef.current) return;
        setBioSource('offline');
      } finally {
        if (!controller.signal.aborted && isMountedRef.current) {
          setBioSyncing(false);
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeTab,
    selectedBioTrail?.id,
    selectedBioTrail?.name,
    bioDistanceKm,
    bioGainM,
    bioMaxAltM,
    bioBodyWeightKg,
    bioPackWeightKg,
    bioFitness,
    bioTempC,
    bioDays,
  ]);

  // =========================================================================
  // TAB 4: SOS 2G COMPOSER, NEAREST RANGERS, VISUAL STROBE, 3.1KHZ WHISTLE & ICE CARD
  // =========================================================================
  const [sosPhone, setSosPhone] = useState<string>('112');
  const [sosTrailName, setSosTrailName] = useState<string>(initialTrail?.name || '');
  const [sosNote, setSosNote] = useState<string>(SOS_QUICK_NOTES[0]);

  const findNearestStationForCoords = useCallback((lat: number, lng: number): RangerStationSeed | null => {
    let best: RangerStationSeed | null = null;
    let bestDist = Infinity;
    for (const st of VIETNAM_RANGER_STATIONS) {
      if (st.region === 'Toàn Quốc') continue;
      const dist = calculateHaversineKm(lat, lng, st.coordinates.lat, st.coordinates.lng);
      if (dist < bestDist) {
        bestDist = dist;
        best = st;
      }
    }
    return best;
  }, []);

  const [iceProfile, setIceProfile] = useState<IceCardProfile>(() => {
    const saved = loadIceCardProfile();
    if (!saved.plannedPeak && initialTrail) {
      let nearest: RangerStationSeed | null = null;
      let bestDist = Infinity;
      for (const st of VIETNAM_RANGER_STATIONS) {
        if (st.region === 'Toàn Quốc') continue;
        const d = calculateHaversineKm(
          initialTrail.endLat,
          initialTrail.endLng,
          st.coordinates.lat,
          st.coordinates.lng
        );
        if (d < bestDist) {
          bestDist = d;
          nearest = st;
        }
      }
      return {
        ...saved,
        plannedPeak: `${initialTrail.name} (${initialTrail.maxAltitudeM.toLocaleString('vi-VN')}m)`,
        rangerStationName: saved.rangerStationName || nearest?.name || '',
        rangerHotline: saved.rangerHotline || nearest?.hotlinePhone || '112',
      };
    }
    return saved;
  });
  const [iceTheme, setIceTheme] = useState<IceLockscreenTheme>(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
      ? 'light'
      : 'dark'
  );
  const [icePeakTrailId, setIcePeakTrailId] = useState<string>(initialTrail?.id || '');
  const [icePreviewUrl, setIcePreviewUrl] = useState<string | null>(null);
  const [iceRendering, setIceRendering] = useState<boolean>(false);
  const [iceExporting, setIceExporting] = useState<boolean>(false);
  const [iceError, setIceError] = useState<string | null>(null);
  const [iceStorageError, setIceStorageError] = useState<string | null>(null);
  const [iceTruncatedFields, setIceTruncatedFields] = useState<string[]>([]);
  const [iceConfirmClear, setIceConfirmClear] = useState<boolean>(false);
  const [iceSavedAt, setIceSavedAt] = useState<string | null>(null);
  const iceProfileRef = useRef<IceCardProfile>(iceProfile);
  const iceRenderSeqRef = useRef<number>(0);
  const iceBlobRef = useRef<Blob | null>(null);
  const iceRenderedSigRef = useRef<string>('');
  const iceFileNameRef = useRef<string>('lost-ice-lockscreen-1080x1920.png');
  const icePreviewUrlRef = useRef<string | null>(null);
  const iceDownloadTimersRef = useRef<Set<number>>(new Set());
  const iceDownloadUrlsRef = useRef<Set<string>>(new Set());

  const iceProfileSignature = useMemo(
    () => JSON.stringify({ profile: iceProfile, theme: iceTheme }),
    [iceProfile, iceTheme]
  );

  // Pure React 19 state updater: compute next outside setState, persist once, and report storage quota errors honestly
  const updateIceProfile = useCallback((updater: (prev: IceCardProfile) => IceCardProfile) => {
    const next = updater(iceProfileRef.current);
    iceProfileRef.current = next;
    setIceProfile(next);
    setIceConfirmClear(false);
    if (saveIceCardProfile(next)) {
      setIceStorageError(null);
      setIceSavedAt(
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      );
    } else {
      setIceSavedAt(null);
      setIceStorageError(
        'Trình duyệt đang chặn lưu cục bộ (Chế độ ẩn danh / Đầy bộ nhớ). Hồ sơ ICE chỉ giữ tạm trong phiên này — hãy tải ảnh PNG ngay.'
      );
    }
  }, []);

  // Re-scope ICE medical profile immediately on login / logout / account switch (zero cross-account medical leak)
  useEffect(() => {
    const syncScopedIceProfile = () => {
      if (!isMountedRef.current) return;
      const reloaded = loadIceCardProfile();
      iceProfileRef.current = reloaded;
      iceBlobRef.current = null;
      iceRenderedSigRef.current = '';
      setIceProfile(reloaded);
      setIcePeakTrailId('');
      setIceSavedAt(null);
      setIceStorageError(null);
      setIceTruncatedFields([]);
      setIceConfirmClear(false);
    };
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'lost_token' || e.key.startsWith('lost_ice_card_profile_v1')) {
        syncScopedIceProfile();
      }
    };
    window.addEventListener('lost:auth-changed', syncScopedIceProfile);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('lost:auth-changed', syncScopedIceProfile);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Debounced live 1080x1920 ICE Lockscreen Canvas preview (cancels in-flight renders when leaving SOS tab)
  useEffect(() => {
    if (activeTab !== 'sos') return;
    const sigAtSchedule = iceProfileSignature;
    const timer = window.setTimeout(() => {
      const seq = ++iceRenderSeqRef.current;
      setIceRendering(true);
      setIceError(null);
      void renderIceLockscreenPng({
        profile: iceProfile,
        theme: iceTheme,
      })
        .then((res) => {
          if (seq !== iceRenderSeqRef.current || !isMountedRef.current) return;
          const nextUrl = URL.createObjectURL(res.blob);
          if (icePreviewUrlRef.current) {
            URL.revokeObjectURL(icePreviewUrlRef.current);
          }
          icePreviewUrlRef.current = nextUrl;
          iceBlobRef.current = res.blob;
          iceRenderedSigRef.current = sigAtSchedule;
          iceFileNameRef.current = res.fileName;
          setIcePreviewUrl(nextUrl);
          setIceTruncatedFields(res.truncatedFields);
          setIceRendering(false);
        })
        .catch((err: unknown) => {
          if (seq !== iceRenderSeqRef.current || !isMountedRef.current) return;
          setIceRendering(false);
          setIceError(
            err instanceof Error ? err.message : 'Không thể dựng ảnh thẻ ICE trên trình duyệt này.'
          );
        });
    }, 160);

    return () => {
      window.clearTimeout(timer);
      iceRenderSeqRef.current += 1;
    };
  }, [activeTab, iceProfile, iceTheme, iceProfileSignature]);

  // Guaranteed Blob URL & delayed-revoke timer cleanup on unmount
  useEffect(() => {
    const timersSet = iceDownloadTimersRef.current;
    const urlsSet = iceDownloadUrlsRef.current;
    return () => {
      iceRenderSeqRef.current += 1;
      if (icePreviewUrlRef.current) {
        URL.revokeObjectURL(icePreviewUrlRef.current);
        icePreviewUrlRef.current = null;
      }
      timersSet.forEach((id) => window.clearTimeout(id));
      timersSet.clear();
      urlsSet.forEach((u) => URL.revokeObjectURL(u));
      urlsSet.clear();
    };
  }, []);

  const ensureFreshIceBlob = useCallback(async (): Promise<{ blob: Blob; fileName: string }> => {
    const targetSig = iceProfileSignature;
    if (iceBlobRef.current && iceRenderedSigRef.current === targetSig) {
      return { blob: iceBlobRef.current, fileName: iceFileNameRef.current };
    }
    const seq = ++iceRenderSeqRef.current;
    const res = await renderIceLockscreenPng({ profile: iceProfile, theme: iceTheme });
    if (seq === iceRenderSeqRef.current && isMountedRef.current) {
      const nextUrl = URL.createObjectURL(res.blob);
      if (icePreviewUrlRef.current) {
        URL.revokeObjectURL(icePreviewUrlRef.current);
      }
      icePreviewUrlRef.current = nextUrl;
      iceBlobRef.current = res.blob;
      iceRenderedSigRef.current = targetSig;
      iceFileNameRef.current = res.fileName;
      setIcePreviewUrl(nextUrl);
      setIceTruncatedFields(res.truncatedFields);
      setIceError(null);
      setIceRendering(false);
    }
    return { blob: res.blob, fileName: res.fileName };
  }, [iceProfile, iceTheme, iceProfileSignature]);

  const triggerIceBlobDownload = useCallback((blob: Blob, fileName: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    iceDownloadUrlsRef.current.add(downloadUrl);
    try {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      const timerId = window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
        iceDownloadUrlsRef.current.delete(downloadUrl);
        iceDownloadTimersRef.current.delete(timerId);
      }, 1500);
      iceDownloadTimersRef.current.add(timerId);
    } catch (err) {
      URL.revokeObjectURL(downloadUrl);
      iceDownloadUrlsRef.current.delete(downloadUrl);
      throw err;
    }
  }, []);

  const handleDownloadIcePng = useCallback(async () => {
    if (iceExporting) return;
    setIceExporting(true);
    try {
      const { blob, fileName } = await ensureFreshIceBlob();
      if (!isMountedRef.current) return;
      triggerIceBlobDownload(blob, fileName);
      onShowToast?.(
        'Đã tải ảnh màn hình khóa ICE (1080×1920 PNG). Hãy đặt làm hình nền khóa trước chuyến đi.',
        'success'
      );
    } catch {
      if (isMountedRef.current) {
        onShowToast?.('Không thể xuất ảnh PNG thẻ ICE lúc này.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIceExporting(false);
      }
    }
  }, [ensureFreshIceBlob, iceExporting, onShowToast, triggerIceBlobDownload]);

  const handleShareIcePng = useCallback(async () => {
    if (iceExporting) return;
    setIceExporting(true);
    try {
      let rendered: { blob: Blob; fileName: string };
      try {
        rendered = await ensureFreshIceBlob();
      } catch {
        if (isMountedRef.current) {
          onShowToast?.('Không thể dựng ảnh PNG thẻ ICE lúc này.', 'error');
        }
        return;
      }
      if (!isMountedRef.current) return;

      const { blob, fileName } = rendered;
      const file = new File([blob], fileName, { type: 'image/png' });
      const navWithShare = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (
        typeof navWithShare.share === 'function' &&
        typeof navWithShare.canShare === 'function' &&
        navWithShare.canShare({ files: [file] })
      ) {
        try {
          await navWithShare.share({
            title: 'Thẻ Y Tế Khẩn Cấp ICE • LOST',
            text: 'Ảnh màn hình khóa y tế khẩn cấp ICE (1080×1920) tạo ngoại tuyến bằng LOST.',
            files: [file],
          });
          return;
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') return;
          // Fall through to local PNG download ONLY when navigator.share itself fails
        }
      }

      if (!isMountedRef.current) return;
      triggerIceBlobDownload(blob, fileName);
      onShowToast?.(
        'Đã tải ảnh màn hình khóa ICE (1080×1920 PNG) về thiết bị.',
        'success'
      );
    } catch {
      if (isMountedRef.current) {
        onShowToast?.('Không thể chia sẻ hoặc lưu ảnh PNG thẻ ICE lúc này.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIceExporting(false);
      }
    }
  }, [ensureFreshIceBlob, iceExporting, onShowToast, triggerIceBlobDownload]);

  const handleSelectIcePeak = useCallback(
    (trailId: string) => {
      setIcePeakTrailId(trailId);
      const chosen = trails.find((t) => t.id === trailId);
      if (!chosen) return;
      const nearest = findNearestStationForCoords(chosen.endLat, chosen.endLng);
      updateIceProfile((prev) => ({
        ...prev,
        plannedPeak: `${chosen.name} (${chosen.maxAltitudeM.toLocaleString('vi-VN')}m)`,
        rangerStationName: nearest?.name || prev.rangerStationName,
        rangerHotline: nearest?.hotlinePhone || prev.rangerHotline || '112',
      }));
      onShowToast?.(
        `Đã đồng bộ ${chosen.name} và trạm ${nearest?.name || 'kiểm lâm gần nhất'} vào thẻ ICE.`,
        'info'
      );
    },
    [findNearestStationForCoords, onShowToast, trails, updateIceProfile]
  );

  const handleClearIceProfile = useCallback(() => {
    clearIceCardProfile();
    const freshEmpty = { ...DEFAULT_ICE_CARD_PROFILE };
    iceProfileRef.current = freshEmpty;
    iceBlobRef.current = null;
    iceRenderedSigRef.current = '';
    setIceProfile(freshEmpty);
    setIcePeakTrailId('');
    setIceSavedAt(null);
    setIceStorageError(null);
    setIceTruncatedFields([]);
    setIceConfirmClear(false);
    onShowToast?.('Đã xóa toàn bộ thông tin ICE khỏi bộ nhớ cục bộ thiết bị.', 'info');
  }, [onShowToast]);

  const [strobeActive, setStrobeActive] = useState<boolean>(false);
  const [strobeLit, setStrobeLit] = useState<boolean>(false);
  const [strobeSymbolIdx, setStrobeSymbolIdx] = useState<number>(-1);
  const strobeDialogRef = useRef<HTMLDivElement | null>(null);
  const strobeStopBtnRef = useRef<HTMLButtonElement | null>(null);
  useFocusTrap(strobeActive, strobeDialogRef, { initialFocusRef: strobeStopBtnRef });

  const [whistleActive, setWhistleActive] = useState<boolean>(false);
  const [whistleVolume, setWhistleVolume] = useState<number>(0.7);
  const [whistleSymbolIdx, setWhistleSymbolIdx] = useState<number>(-1);
  const whistleAudioCtxRef = useRef<AudioContext | null>(null);
  const whistleOscMainRef = useRef<OscillatorNode | null>(null);
  const whistleOscHarmRef = useRef<OscillatorNode | null>(null);
  const whistleGainRef = useRef<GainNode | null>(null);
  const whistleTimerRef = useRef<number | null>(null);
  const whistleVolumeRef = useRef<number>(whistleVolume);

  useEffect(() => {
    whistleVolumeRef.current = whistleVolume;
  }, [whistleVolume]);

  const nationalHotlines = useMemo(
    () => VIETNAM_RANGER_STATIONS.filter((s) => s.region === 'Toàn Quốc'),
    []
  );

  const referenceSosCoords = useMemo(() => {
    if (gpsLock) return { lat: gpsLock.lat, lng: gpsLock.lng, label: 'Tọa độ GPS thực tế' };
    if (initialTrail) return { lat: initialTrail.endLat, lng: initialTrail.endLng, label: initialTrail.name };
    return { lat: 22.3033, lng: 103.775, label: 'Đỉnh Fansipan (mặc định)' };
  }, [gpsLock, initialTrail]);

  const nearestRangerStations = useMemo<Array<{ station: RangerStationSeed; distanceKm: number }>>(() => {
    return VIETNAM_RANGER_STATIONS.filter((s) => s.region !== 'Toàn Quốc')
      .map((station) => ({
        station,
        distanceKm: calculateHaversineKm(
          referenceSosCoords.lat,
          referenceSosCoords.lng,
          station.coordinates.lat,
          station.coordinates.lng
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [referenceSosCoords]);

  const smsPayload = useMemo(
    () =>
      buildOfflineSosSmsUri({
        phone: sosPhone,
        trailName: sosTrailName || referenceSosCoords.label,
        lat: gpsLock?.lat ?? referenceSosCoords.lat,
        lng: gpsLock?.lng ?? referenceSosCoords.lng,
        altitudeM: gpsLock?.altitudeM ?? initialTrail?.maxAltitudeM ?? null,
        note: sosNote,
      }),
    [sosPhone, sosTrailName, referenceSosCoords, gpsLock, initialTrail?.maxAltitudeM, sosNote]
  );

  // Full-screen Visual SOS Strobe Morse scheduler + Escape exit
  useEffect(() => {
    if (!strobeActive) return;

    let stepIndex = 0;
    let timerId: number | null = null;
    let cancelled = false;

    const runStep = () => {
      if (cancelled) return;
      const elem = MORSE_SOS_PATTERN[stepIndex];
      setStrobeLit(elem.on);
      setStrobeSymbolIdx(elem.on ? elem.symbolIndex : -1);
      stepIndex = (stepIndex + 1) % MORSE_SOS_PATTERN.length;
      timerId = window.setTimeout(runStep, elem.ms);
    };

    runStep();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(strobeDialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setStrobeActive(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener('keydown', handleKeyDown);
      setStrobeLit(false);
      setStrobeSymbolIdx(-1);
    };
  }, [strobeActive]);

  // Guaranteed AudioContext + Oscillator cleanup for 3.1kHz Alpine Rescue Whistle
  const stopRescueWhistle = useCallback(() => {
    if (whistleTimerRef.current !== null) {
      window.clearTimeout(whistleTimerRef.current);
      whistleTimerRef.current = null;
    }
    try {
      whistleOscMainRef.current?.stop();
    } catch {
      // ignore if already stopped
    }
    try {
      whistleOscHarmRef.current?.stop();
    } catch {
      // ignore if already stopped
    }
    whistleOscMainRef.current = null;
    whistleOscHarmRef.current = null;
    whistleGainRef.current = null;
    if (whistleAudioCtxRef.current) {
      void whistleAudioCtxRef.current.close().catch(() => undefined);
      whistleAudioCtxRef.current = null;
    }
    setWhistleActive(false);
    setWhistleSymbolIdx(-1);
  }, []);

  const startRescueWhistle = useCallback(() => {
    stopRescueWhistle();
    try {
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) {
        onShowToast?.('Trình duyệt không hỗ trợ Web Audio API cho còi cứu hộ.', 'error');
        return;
      }

      const ctx = new AudioCtxCtor();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.connect(ctx.destination);

      // Authentic Alpine rescue whistle frequency: 3100 Hz primary + subtle 3165 Hz pea-whistle modulation
      const oscMain = ctx.createOscillator();
      oscMain.type = 'sine';
      oscMain.frequency.setValueAtTime(3100, ctx.currentTime);

      const oscHarm = ctx.createOscillator();
      oscHarm.type = 'triangle';
      oscHarm.frequency.setValueAtTime(3165, ctx.currentTime);

      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(0.22, ctx.currentTime);

      oscMain.connect(gainNode);
      oscHarm.connect(harmGain);
      harmGain.connect(gainNode);

      oscMain.start();
      oscHarm.start();

      whistleAudioCtxRef.current = ctx;
      whistleOscMainRef.current = oscMain;
      whistleOscHarmRef.current = oscHarm;
      whistleGainRef.current = gainNode;
      setWhistleActive(true);

      let stepIndex = 0;
      const tick = () => {
        const currentCtx = whistleAudioCtxRef.current;
        const currentGain = whistleGainRef.current;
        if (!currentCtx || !currentGain) return;

        const elem = MORSE_SOS_PATTERN[stepIndex];
        const now = currentCtx.currentTime;
        const targetAmp = elem.on ? Math.max(0.05, Math.min(0.85, whistleVolumeRef.current * 0.7)) : 0.0001;
        currentGain.gain.cancelScheduledValues(now);
        currentGain.gain.setTargetAtTime(targetAmp, now, 0.012);
        setWhistleSymbolIdx(elem.on ? elem.symbolIndex : -1);

        stepIndex = (stepIndex + 1) % MORSE_SOS_PATTERN.length;
        whistleTimerRef.current = window.setTimeout(tick, elem.ms);
      };
      tick();
    } catch {
      stopRescueWhistle();
      onShowToast?.('Không thể khởi tạo âm thanh còi SOS. Hãy thử bấm lại.', 'error');
    }
  }, [onShowToast, stopRescueWhistle]);

  useEffect(() => {
    return () => {
      stopRescueWhistle();
    };
  }, [stopRescueWhistle]);

  // =========================================================================
  // TAB 5: VIETNAM WILDERNESS SURVIVAL DRILL ACADEMY (8 REAL SCENARIOS)
  // =========================================================================
  const [drillAnswers, setDrillAnswers] = useState<Record<string, string>>(loadSavedDrillAnswers);
  const [activeDrillIdx, setActiveDrillIdx] = useState<number>(0);

  const activeDrill = VIETNAM_SURVIVAL_DRILLS[activeDrillIdx] || VIETNAM_SURVIVAL_DRILLS[0];
  const activeSelectedOption = drillAnswers[activeDrill.id] || null;
  const activeIsCorrect = activeSelectedOption === activeDrill.correctOptionId;

  const drillStats = useMemo(() => {
    let answered = 0;
    let correct = 0;
    for (const sc of VIETNAM_SURVIVAL_DRILLS) {
      const ans = drillAnswers[sc.id];
      if (ans) {
        answered += 1;
        if (ans === sc.correctOptionId) correct += 1;
      }
    }
    const percent = Math.round((correct / VIETNAM_SURVIVAL_DRILLS.length) * 100);
    return { answered, correct, total: VIETNAM_SURVIVAL_DRILLS.length, percent };
  }, [drillAnswers]);

  const handleSelectDrillOption = (scenarioId: string, optionId: 'A' | 'B' | 'C' | 'D') => {
    const next = { ...drillAnswers, [scenarioId]: optionId };
    setDrillAnswers(next);
    saveDrillAnswers(next);
  };

  const handleResetDrills = () => {
    setDrillAnswers({});
    saveDrillAnswers({});
    setActiveDrillIdx(0);
    onShowToast?.('Đã đặt lại toàn bộ 8 bài tập Học Viện Sinh Tồn.', 'info');
  };

  // Sync initialTrailId when switching trails in-place across hub deep-links
  useEffect(() => {
    if (!initialTrailId || initialTrailId === lastSyncedTrailIdRef.current) return;
    lastSyncedTrailIdRef.current = initialTrailId;
    const tr = trails.find((t) => t.id === initialTrailId);
    if (!tr) return;
    const rafId = window.requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      setTargetTrailId(tr.id);
      setTargetLat(tr.endLat.toFixed(6));
      setTargetLng(tr.endLng.toFixed(6));
      setOriginLat(tr.startLat.toFixed(6));
      setOriginLng(tr.startLng.toFixed(6));
      setPhysicsTrailId(tr.id);
      setPhysicsAltM(Math.max(0, Math.min(3200, tr.maxAltitudeM)));
      setPhysicsSourceLabel(tr.name);
      if (!iceProfileRef.current.plannedPeak) {
        const nearest = findNearestStationForCoords(tr.endLat, tr.endLng);
        const hydratedIce: IceCardProfile = {
          ...iceProfileRef.current,
          plannedPeak: `${tr.name} (${tr.maxAltitudeM.toLocaleString('vi-VN')}m)`,
          rangerStationName: iceProfileRef.current.rangerStationName || nearest?.name || '',
          rangerHotline: iceProfileRef.current.rangerHotline || nearest?.hotlinePhone || '112',
        };
        iceProfileRef.current = hydratedIce;
        setIceProfile(hydratedIce);
        setIcePeakTrailId(tr.id);
      }
      setSolarTrailId(tr.id);
      setSolarLat(tr.endLat.toFixed(5));
      setSolarLng(tr.endLng.toFixed(5));
      setSolarAltitudeM(tr.maxAltitudeM);
      setBioTrailId(tr.id);
      setBioDistanceKm(tr.distanceKm);
      setBioGainM(tr.elevationGainM);
      setBioMaxAltM(tr.maxAltitudeM);
      setBioDays(tr.durationDays || 1);
      setBioTempC(tr.maxAltitudeM >= 2400 ? 15 : tr.maxAltitudeM >= 1400 ? 21 : 27);
      setSosTrailName(tr.name);
      setActiveTab(resolveToolkitTabFromUrl());
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [initialTrailId, trails, findNearestStationForCoords]);

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onShowToast?.(`Đã sao chép ${label}.`, 'success');
    } catch {
      onShowToast?.('Trình duyệt không cho phép sao chép tự động.', 'error');
    }
  };

  // =========================================================================
  // PURE-SVG SOLAR ARC GEOMETRY HELPERS
  // =========================================================================
  const solarSvgGeometry = useMemo(() => {
    const W = 640;
    const H = 240;
    const padL = 44;
    const padR = 20;
    const padT = 22;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const minAlt = -30;
    const maxAlt = 92;

    const toX = (hour: number) => padL + (Math.max(0, Math.min(24, hour)) / 24) * plotW;
    const toY = (altDeg: number) => {
      const clamped = Math.max(minAlt, Math.min(maxAlt, altDeg));
      return padT + ((maxAlt - clamped) / (maxAlt - minAlt)) * plotH;
    };

    const horizonY = toY(0);
    const pointsStr = solarData.arcSamples
      .map((s) => `${toX(s.hour).toFixed(1)},${toY(s.altitudeDeg).toFixed(1)}`)
      .join(' ');

    // Daylight area polygon (clamped above horizon)
    const daylightSamples = solarData.arcSamples.filter(
      (s) => s.hour >= solarData.sunriseHours && s.hour <= solarData.sunsetHours
    );
    const daylightAreaPoints = [
      `${toX(solarData.sunriseHours).toFixed(1)},${horizonY.toFixed(1)}`,
      ...daylightSamples.map((s) => `${toX(s.hour).toFixed(1)},${toY(Math.max(0, s.altitudeDeg)).toFixed(1)}`),
      `${toX(solarData.sunsetHours).toFixed(1)},${horizonY.toFixed(1)}`,
    ].join(' ');

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      horizonY,
      toX,
      toY,
      pointsStr,
      daylightAreaPoints,
      currentX: toX(solarData.currentLocalHours),
      currentY: toY(solarData.currentSunAltitudeDeg),
      sunriseX: toX(solarData.sunriseHours),
      sunsetX: toX(solarData.sunsetHours),
      noonX: toX(solarData.solarNoonHours),
      noonY: toY(solarData.solarNoonAltitudeDeg),
      goldenAmX1: toX(solarData.sunriseHours),
      goldenAmX2: toX(solarData.goldenHourMorningEndHours),
      goldenPmX1: toX(solarData.goldenHourEveningStartHours),
      goldenPmX2: toX(solarData.sunsetHours),
    };
  }, [solarData]);

  // =========================================================================
  // PURE-SVG PACK WEIGHT RATIO GAUGE GEOMETRY
  // =========================================================================
  const packGaugeGeometry = useMemo(() => {
    const ratio = Math.max(0, Math.min(35, activeBioMetrics.packRatioPercent));
    // Semicircle from 180 deg (left) to 0 deg (right), mapping 0%..35%
    const angleDeg = 180 - (ratio / 35) * 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = 130;
    const cy = 122;
    const r = 92;
    const needleLen = 76;
    const nx = cx + needleLen * Math.cos(angleRad);
    const ny = cy - needleLen * Math.sin(angleRad);

    const arcSegment = (startPct: number, endPct: number) => {
      const a1 = ((180 - (startPct / 35) * 180) * Math.PI) / 180;
      const a2 = ((180 - (endPct / 35) * 180) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy - r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy - r * Math.sin(a2);
      return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };

    const statusColor =
      activeBioMetrics.packStatus === 'optimal'
        ? 'var(--color-primary)'
        : activeBioMetrics.packStatus === 'caution'
          ? 'var(--color-sun)'
          : 'var(--color-error)';

    return {
      cx,
      cy,
      nx,
      ny,
      optimalPath: arcSegment(0, 18),
      cautionPath: arcSegment(18, 22),
      overweightPath: arcSegment(22, 35),
      statusColor,
    };
  }, [activeBioMetrics.packRatioPercent, activeBioMetrics.packStatus]);

  const gpsAccuracyMeta = getAccuracyMeta(gpsLock?.accuracyM ?? null);
  const formattedDmsPair = `${latDeg}°${String(latMin).padStart(2, '0')}'${latSec}"${latDir}  ${lngDeg}°${String(lngMin).padStart(2, '0')}'${lngSec}"${lngDir}`;

  // Relative angle of target bearing on rotated compass rose
  const relativeBearingOnRose = (bearingMetrics.forwardDeg - headingDeg + 360) % 360;

  return (
    <section className="hub-container page-view-slide" aria-label="Bộ Công Cụ Sinh Tồn Thực Địa LOST">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div className="section-eyebrow">LOST FIELD SURVIVAL CONSOLE • 100% OFFLINE</div>
          <h1
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.65rem, 3.2vw, 2.35rem)',
              color: 'var(--color-text-main)',
              lineHeight: 1.15,
              marginBottom: 6,
            }}
          >
            Bộ Công Cụ Sinh Tồn Thực Địa
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 680, lineHeight: 1.55 }}>
            La bàn từ kế, chuyển đổi tọa độ WGS84, tính giờ săn mây NOAA, định mức nước/calo/balo và phát tín hiệu cứu hộ SOS 2G — hoạt động ổn định ngay cả khi mất hoàn toàn kết nối mạng trên núi cao.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="badge badge-success">
            <IconShieldCheck size={13} />
            Hoạt động ngoại tuyến 100%
          </span>
          {onBack && (
            <button type="button" className="btn btn-outline" onClick={onBack}>
              <IconArrowLeft size={16} />
              Quay lại
            </button>
          )}
        </div>
      </div>

      {/* 7-Tab Bar (WAI-ARIA Tablist with Liquid Glider & Roving Tabindex) */}
      <div
        ref={toolkitTabTrackRef}
        className="editorial-tabs-bar has-glider"
        role="tablist"
        aria-label="Chức năng sinh tồn thực địa"
      >
        <span aria-hidden="true" className="lost-glider-tab" style={toolkitTabIndicatorStyle} />
        {(
          [
            { id: 'compass' as const, icon: <IconCompass size={16} />, label: 'La Bàn & Tọa Độ GPS' },
            { id: 'solar' as const, icon: <IconSun size={16} />, label: 'Mặt Trời, Giờ Vàng & Săn Mây' },
            { id: 'bio' as const, icon: <IconBackpack size={16} />, label: 'Nước, Calo & Balo' },
            { id: 'sos' as const, icon: <IconShieldAlert size={16} />, label: 'SOS 2G & Tín Hiệu Khẩn Cấp' },
            {
              id: 'academy' as const,
              icon: <IconBookOpen size={16} />,
              label: `Học Viện Sinh Tồn (${drillStats.correct}/${drillStats.total})`,
            },
            { id: 'offline' as const, icon: <IconDownload size={16} />, label: 'Bộ Nhớ Offline' },
            { id: 'quiz' as const, icon: <IconMountain size={16} />, label: 'Thử Tài Địa Hình' },
          ] as const
        ).map((tab, idx) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[tab.id] = el;
              }}
              data-glider-active={isSelected ? 'true' : undefined}
              id={`toolkit-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={isSelected ? `toolkit-panel-${tab.id}` : undefined}
              tabIndex={isSelected ? 0 : -1}
              className={`editorial-tab-btn${isSelected ? ' active' : ''}`}
              onClick={() => handleSelectTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`toolkit-panel-${activeTab}`}
        aria-labelledby={`toolkit-tab-${activeTab}`}
      >

        {/* ================================================================= */}
        {/* TAB 1: LA BÀN & TỌA ĐỘ GPS                                        */}
        {/* ================================================================= */}
        {activeTab === 'compass' && (
          <div className="tab-content-slide" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="hub-grid-2">
              {/* Pure-SVG Rotating Compass Rose Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                      La Bàn Từ Kế & Định Hướng Mục Tiêu
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{sensorStatus}</p>
                  </div>
                  <button
                    type="button"
                    className={compassMode === 'sensor' ? 'btn btn-primary' : 'btn btn-outline'}
                    onClick={handleToggleCompassSensor}
                    style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                  >
                    <IconCompass size={15} />
                    {compassMode === 'sensor' ? 'Đang bật Cảm biến' : 'Bật Cảm biến Thiết bị'}
                  </button>
                </div>

                {/* Pure-SVG Compass Rose */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px 0' }}>
                  <svg
                    viewBox="0 0 280 280"
                    width="270"
                    height="270"
                    role="img"
                    aria-label={`La bàn hướng ${headingDeg} độ ${getCardinalDirectionLabel(headingDeg)}`}
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                  >
                    {/* Fixed Lubber Reference Triangle at Top (12 o'clock) */}
                    <polygon points="140,4 134,16 146,16" fill="var(--color-error)" />

                    {/* Outer Bezel */}
                    <circle cx="140" cy="140" r="120" fill="var(--color-surface-elevated)" stroke="var(--color-border-strong)" strokeWidth="2" />
                    <circle cx="140" cy="140" r="92" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1" />

                    {/* Rotating Compass Dial */}
                    <g transform={`rotate(${-headingDeg} 140 140)`}>
                      {Array.from({ length: 72 }).map((_, i) => {
                        const deg = i * 5;
                        const isMajor = deg % 30 === 0;
                        const isMid = deg % 15 === 0 && !isMajor;
                        const rOut = 116;
                        const rIn = isMajor ? 102 : isMid ? 107 : 111;
                        const rad = ((deg - 90) * Math.PI) / 180;
                        const x1 = 140 + rIn * Math.cos(rad);
                        const y1 = 140 + rIn * Math.sin(rad);
                        const x2 = 140 + rOut * Math.cos(rad);
                        const y2 = 140 + rOut * Math.sin(rad);
                        return (
                          <line
                            key={deg}
                            x1={x1.toFixed(1)}
                            y1={y1.toFixed(1)}
                            x2={x2.toFixed(1)}
                            y2={y2.toFixed(1)}
                            stroke={deg === 0 ? 'var(--color-error)' : isMajor ? 'var(--color-text-main)' : 'var(--color-text-dim)'}
                            strokeWidth={deg === 0 ? 2.5 : isMajor ? 1.6 : 0.9}
                          />
                        );
                      })}

                      {/* Cardinal & Intercardinal Labels */}
                      {[
                        { deg: 0, label: 'B', color: 'var(--color-error-text, var(--color-error))', size: 14, weight: 800 },
                        { deg: 90, label: 'Đ', color: 'var(--color-text-main)', size: 13, weight: 700 },
                        { deg: 180, label: 'N', color: 'var(--color-text-main)', size: 13, weight: 700 },
                        { deg: 270, label: 'T', color: 'var(--color-text-main)', size: 13, weight: 700 },
                        { deg: 45, label: 'ĐB', color: 'var(--color-text-muted)', size: 9.5, weight: 600 },
                        { deg: 135, label: 'ĐN', color: 'var(--color-text-muted)', size: 9.5, weight: 600 },
                        { deg: 225, label: 'TN', color: 'var(--color-text-muted)', size: 9.5, weight: 600 },
                        { deg: 315, label: 'TB', color: 'var(--color-text-muted)', size: 9.5, weight: 600 },
                      ].map((c) => {
                        const rad = ((c.deg - 90) * Math.PI) / 180;
                        const tx = 140 + 80 * Math.cos(rad);
                        const ty = 140 + 80 * Math.sin(rad);
                        return (
                          <text
                            key={c.deg}
                            x={tx.toFixed(1)}
                            y={(ty + 4).toFixed(1)}
                            textAnchor="middle"
                            fill={c.color}
                            fontSize={c.size}
                            fontWeight={c.weight}
                            style={{ fontFamily: 'var(--font-family)' }}
                          >
                            {c.label}
                          </text>
                        );
                      })}

                      {/* True North Needle inside Dial */}
                      <polygon points="140,42 134,140 146,140" fill="var(--color-error)" opacity="0.88" />
                      <polygon points="140,238 134,140 146,140" fill="var(--color-text-dim)" opacity="0.35" />
                    </g>

                    {/* Target Bearing Vector Indicator (relative to current heading) */}
                    <g transform={`rotate(${relativeBearingOnRose} 140 140)`}>
                      <line
                        x1="140"
                        y1="140"
                        x2="140"
                        y2="34"
                        stroke="var(--color-primary)"
                        strokeWidth="2.4"
                        strokeDasharray="4 3"
                      />
                      <polygon points="140,24 134,37 146,37" fill="var(--color-primary)" />
                    </g>

                    {/* Center Digital Readout Disc */}
                    <circle cx="140" cy="140" r="37" fill="var(--color-bg-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
                    <text
                      x="140"
                      y="137"
                      textAnchor="middle"
                      fill="var(--color-text-main)"
                      fontSize="18"
                      fontWeight="800"
                      style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {headingDeg}°
                    </text>
                    <text
                      x="140"
                      y="153"
                      textAnchor="middle"
                      fill="var(--color-primary)"
                      fontSize="9.5"
                      fontWeight="700"
                      style={{ fontFamily: 'var(--font-family)' }}
                    >
                      {getCardinalDirectionLabel(headingDeg).split(' ')[0]}
                    </text>
                  </svg>
                </div>

                {/* Manual Azimuth Slider & Quick Cardinal Presets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    <span>Xoay góc phương vị thủ công (mô phỏng / định hướng bản đồ)</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                      {headingDeg}° • {getCardinalDirectionLabel(headingDeg)}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={headingDeg}
                    aria-label="Góc phương vị la bàn"
                    onChange={(e) => {
                      setCompassMode('manual');
                      setHeadingDeg(Number(e.target.value));
                    }}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Bắc 0°', deg: 0 },
                      { label: 'Đông 90°', deg: 90 },
                      { label: 'Nam 180°', deg: 180 },
                      { label: 'Tây 270°', deg: 270 },
                    ].map((p) => (
                      <button
                        key={p.deg}
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setCompassMode('manual');
                          setHeadingDeg(p.deg);
                        }}
                        style={{ padding: '5px 10px', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      paddingTop: 4,
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 3, background: 'var(--color-error)', display: 'inline-block' }} />
                      Kim Đỏ: Bắc Thực (0°)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 3, background: 'var(--color-primary)', display: 'inline-block' }} />
                      Mũi tên Xanh: Hướng tới Đỉnh mục tiêu ({bearingMetrics.forwardDeg}°)
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live GPS Lock + WGS84 <-> DMS Converter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Live GPS Lock Card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconCrosshairSvg size={18} />
                      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Khóa Tọa Độ GPS Thực Tế
                      </h2>
                    </div>
                    <span className={`badge ${gpsAccuracyMeta.badgeClass}`}>{gpsAccuracyMeta.label}</span>
                  </div>

                  {gpsLock ? (
                    <div className="editorial-stat-strip">
                      <div className="editorial-stat-cell">
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Vĩ độ (Lat)
                        </span>
                        <strong style={{ fontSize: '0.96rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                          {gpsLock.lat.toFixed(6)}°
                        </strong>
                      </div>
                      <div className="editorial-stat-cell">
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Kinh độ (Lng)
                        </span>
                        <strong style={{ fontSize: '0.96rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                          {gpsLock.lng.toFixed(6)}°
                        </strong>
                      </div>
                      <div className="editorial-stat-cell">
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Cao độ GPS
                        </span>
                        <strong style={{ fontSize: '0.96rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {gpsLock.altitudeM !== null ? `${gpsLock.altitudeM} m` : 'Không có dữ liệu'}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      Bấm nút bên dưới để lấy tọa độ vệ tinh trực tiếp từ chip GPS của thiết bị (không cần 4G/Wi-Fi).
                    </p>
                  )}

                  {gpsError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 4,
                        background: 'var(--banner-danger-bg)',
                        color: 'var(--banner-danger-text)',
                        border: '1px solid var(--banner-danger-border)',
                        fontSize: '0.8rem',
                      }}
                    >
                      {gpsError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleLockGps}
                      disabled={gpsLoading}
                    >
                      <IconMapPin size={15} />
                      {gpsLoading ? 'Đang bắt tín hiệu vệ tinh...' : 'Khóa Tọa Độ GPS Ngay'}
                    </button>
                    {gpsLock && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleCopyText(`${gpsLock.lat.toFixed(6)}, ${gpsLock.lng.toFixed(6)}`, 'tọa độ WGS84')}
                      >
                        <IconCopy size={15} />
                        Sao chép WGS84
                      </button>
                    )}
                  </div>
                </div>

                {/* Bidirectional WGS84 Decimal <-> DMS Converter */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      Chuyển Đổi WGS84 Thập Phân ↔ Độ-Phút-Giây (DMS)
                    </h2>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                      onClick={() => handleCopyText(formattedDmsPair, 'tọa độ DMS')}
                    >
                      <IconCopy size={14} />
                      Chép DMS
                    </button>
                  </div>

                  {/* Preset Trail Picker */}
                  <div>
                    <label className="form-label" htmlFor="dms-trail-preset" style={{ display: 'block', marginBottom: 6 }}>
                      Nạp nhanh tọa độ đỉnh thực tế LOST
                    </label>
                    <select
                      id="dms-trail-preset"
                      className="form-select"
                      defaultValue=""
                      onChange={(e) => {
                        const tr = trails.find((t) => t.id === e.target.value);
                        if (tr) applyDecimalCoords(tr.endLat, tr.endLng);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-surface-elevated)',
                        color: 'var(--color-text-main)',
                        fontSize: '0.84rem',
                      }}
                    >
                      <option value="">-- Chọn 1 trong {trails.length} đỉnh LOST để nạp tọa độ --</option>
                      {trails.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.name} ({tr.maxAltitudeM}m — {tr.province})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Decimal Inputs */}
                  <div className="hub-grid-2" style={{ gap: 12 }}>
                    <div>
                      <label className="form-label" htmlFor="dec-lat-input" style={{ display: 'block', marginBottom: 4 }}>
                        Vĩ độ thập phân (Decimal Lat)
                      </label>
                      <input
                        id="dec-lat-input"
                        type="number"
                        step="0.0001"
                        value={decLat}
                        onChange={(e) => handleDecimalLatInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '0.88rem',
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="dec-lng-input" style={{ display: 'block', marginBottom: 4 }}>
                        Kinh độ thập phân (Decimal Lng)
                      </label>
                      <input
                        id="dec-lng-input"
                        type="number"
                        step="0.0001"
                        value={decLng}
                        onChange={(e) => handleDecimalLngInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '0.88rem',
                        }}
                      />
                    </div>
                  </div>

                  {/* DMS Lat Row */}
                  <div>
                    <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Vĩ độ DMS (Độ ° / Phút &apos; / Giây &quot;)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr) 64px', gap: 6 }}>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={latDeg}
                        aria-label="Vĩ độ - Độ"
                        onChange={(e) => handleDmsLatChange(e.target.value, latMin, latSec, latDir)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={latMin}
                        aria-label="Vĩ độ - Phút"
                        onChange={(e) => handleDmsLatChange(latDeg, e.target.value, latSec, latDir)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={59.9}
                        step="0.1"
                        value={latSec}
                        aria-label="Vĩ độ - Giây"
                        onChange={(e) => handleDmsLatChange(latDeg, latMin, e.target.value, latDir)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <select
                        value={latDir}
                        aria-label="Bán cầu vĩ độ"
                        onChange={(e) => handleDmsLatChange(latDeg, latMin, latSec, e.target.value as CardinalHemisphere)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-surface-elevated)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="N">N</option>
                        <option value="S">S</option>
                      </select>
                    </div>
                  </div>

                  {/* DMS Lng Row */}
                  <div>
                    <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Kinh độ DMS (Độ ° / Phút &apos; / Giây &quot;)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr) 64px', gap: 6 }}>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={lngDeg}
                        aria-label="Kinh độ - Độ"
                        onChange={(e) => handleDmsLngChange(e.target.value, lngMin, lngSec, lngDir)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={lngMin}
                        aria-label="Kinh độ - Phút"
                        onChange={(e) => handleDmsLngChange(lngDeg, e.target.value, lngSec, lngDir)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={59.9}
                        step="0.1"
                        value={lngSec}
                        aria-label="Kinh độ - Giây"
                        onChange={(e) => handleDmsLngChange(lngDeg, lngMin, e.target.value, lngDir)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <select
                        value={lngDir}
                        aria-label="Bán cầu kinh độ"
                        onChange={(e) => handleDmsLngChange(lngDeg, lngMin, lngSec, e.target.value as CardinalHemisphere)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          padding: '7px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-surface-elevated)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="E">E</option>
                        <option value="W">W</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 4,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    Chuẩn DMS: {formattedDmsPair}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Point Azimuth Bearing & Distance Calculator */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                    Tính Phương Vị & Khoảng Cách Đường Chim Bay (A → B)
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    Chọn đỉnh núi LOST làm đích để hiển thị trực tiếp mũi tên phương vị lên mặt La bàn phía trên.
                  </p>
                </div>
                {gpsLock && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    onClick={() => {
                      setOriginLat(gpsLock.lat.toFixed(6));
                      setOriginLng(gpsLock.lng.toFixed(6));
                    }}
                  >
                    Dùng GPS hiện tại làm Điểm A
                  </button>
                )}
              </div>

              <div className="hub-grid-2">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="badge badge-info" style={{ alignSelf: 'flex-start' }}>Điểm Xuất Phát (A)</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label" htmlFor="origin-lat" style={{ display: 'block', marginBottom: 4 }}>
                        Vĩ độ A
                      </label>
                      <input
                        id="origin-lat"
                        type="number"
                        step="0.0001"
                        value={originLat}
                        onChange={(e) => setOriginLat(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="origin-lng" style={{ display: 'block', marginBottom: 4 }}>
                        Kinh độ A
                      </label>
                      <input
                        id="origin-lng"
                        type="number"
                        step="0.0001"
                        value={originLng}
                        onChange={(e) => setOriginLng(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Điểm Đích / Đỉnh Mục Tiêu (B)</span>
                  <select
                    aria-label="Chọn đỉnh núi LOST làm mục tiêu"
                    value={targetTrailId}
                    onChange={(e) => handleSelectTargetTrail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-surface-elevated)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <option value="custom">Tọa độ tùy chỉnh</option>
                    {trails.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        Đỉnh {tr.name} ({tr.maxAltitudeM}m — {tr.province})
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input
                      type="number"
                      step="0.0001"
                      value={targetLat}
                      aria-label="Vĩ độ B"
                      onChange={(e) => {
                        setTargetTrailId('custom');
                        setTargetLat(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={targetLng}
                      aria-label="Kinh độ B"
                      onChange={(e) => {
                        setTargetTrailId('custom');
                        setTargetLng(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="editorial-stat-strip">
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Khoảng Cách Haversine
                  </span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {bearingMetrics.distanceKm.toFixed(2)} km
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    ({Math.round(bearingMetrics.distanceKm * 1000).toLocaleString('vi-VN')} mét)
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Góc Phương Vị Tới (Forward)
                  </span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {bearingMetrics.forwardDeg}°
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    Hướng {bearingMetrics.sector}
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Phương Vị Ngược (Back Azimuth)
                  </span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                    {bearingMetrics.backDeg}°
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    Hướng quay về điểm xuất phát
                  </span>
                </div>
              </div>
            </div>

            {/* Altimeter & Atmospheric Physics Reference Card (ISA Troposphere + Boiling Point) */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                    Cao Độ Kế & Vật Lý Khí Quyển Núi Cao (Chuẩn ISA)
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Tính toán ngoại tuyến 100% độ giảm nhiệt theo cao độ (-6,5°C/1.000m), áp suất khí quyển, phân áp oxy hiệu dụng và điểm sôi nước thực tế để nấu ăn & phòng chống AMS.
                  </p>
                </div>
                <span
                  className={`badge ${altitudePhysics.amsRiskLevel === 'high'
                    ? 'badge-error'
                    : altitudePhysics.amsRiskLevel === 'moderate'
                      ? 'badge-sun'
                      : 'badge-info'
                    }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <IconMountain size={13} />
                  {altitudePhysics.altitudeM.toLocaleString('vi-VN')} m • {physicsSourceLabel}
                </span>
              </div>

              {/* Peak Selector + GPS Altitude Sync Controls */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label className="form-label" htmlFor="isa-peak-select" style={{ display: 'block', marginBottom: 4 }}>
                    Chọn nhanh đỉnh núi LOST ({trails.length} cung thực địa)
                  </label>
                  <select
                    id="isa-peak-select"
                    value={physicsTrailId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPhysicsTrailId(id);
                      const found = trails.find((t) => t.id === id);
                      if (found) {
                        setPhysicsAltM(Math.max(0, Math.min(3200, found.maxAltitudeM)));
                        setPhysicsSourceLabel(found.name);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <option value="">-- Nhập tay / Cao độ GPS --</option>
                    {trails.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.maxAltitudeM.toLocaleString('vi-VN')}m • {t.province})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  disabled={gpsLoading}
                  onClick={() => {
                    if (gpsLock && gpsLock.altitudeM !== null) {
                      const clamped = Math.max(0, Math.min(3200, gpsLock.altitudeM));
                      setPhysicsTrailId('');
                      setPhysicsAltM(clamped);
                      setPhysicsSourceLabel('Cao độ GPS thực tế');
                      onShowToast?.(
                        `Đã đồng bộ cao độ GPS ${clamped.toLocaleString('vi-VN')}m vào bảng vật lý ISA.`,
                        'success'
                      );
                    } else {
                      syncAltimeterOnGpsRef.current = true;
                      handleLockGps();
                    }
                  }}
                >
                  <IconCrosshairSvg size={14} />
                  {gpsLoading
                    ? 'Đang đọc GPS...'
                    : gpsLock?.altitudeM !== null && gpsLock?.altitudeM !== undefined
                      ? `Dùng cao độ GPS (${Math.max(0, Math.min(3200, gpsLock.altitudeM)).toLocaleString('vi-VN')}m)`
                      : 'Đọc cao độ GPS'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  onClick={() => {
                    setPhysicsTrailId('trail-fansipan');
                    setPhysicsAltM(3143);
                    setPhysicsSourceLabel('Đỉnh Fansipan');
                  }}
                >
                  <IconMountain size={14} />
                  Mốc Fansipan (3.143m)
                </button>
              </div>

              {/* Interactive Sliders: Target Altitude + Base/Sea-Level Temperature */}
              <div className="hub-grid-2" style={{ gap: 14 }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    <label htmlFor="isa-alt-slider" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      Cao độ mục tiêu (mực nước biển → đỉnh)
                    </label>
                    <strong style={{ color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {altitudePhysics.altitudeM.toLocaleString('vi-VN')} m
                    </strong>
                  </div>
                  <input
                    id="isa-alt-slider"
                    type="range"
                    min={0}
                    max={3200}
                    step={10}
                    value={Math.max(0, Math.min(3200, altitudePhysics.altitudeM))}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPhysicsTrailId('');
                      setPhysicsAltM(val);
                      setPhysicsSourceLabel('Tùy chỉnh');
                    }}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: '0.7rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                    <span>0 m (Biển)</span>
                    <span>1.500 m</span>
                    <span>2.500 m (AMS)</span>
                    <span>3.143 m (Fansipan)</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    <label htmlFor="isa-base-temp-slider" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      Nền nhiệt mực nước biển (0m)
                    </label>
                    <strong style={{ color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums' }}>
                      {altitudePhysics.seaLevelTempC.toFixed(0)}°C
                    </strong>
                  </div>
                  <input
                    id="isa-base-temp-slider"
                    type="range"
                    min={10}
                    max={38}
                    step={1}
                    value={altitudePhysics.seaLevelTempC}
                    onChange={(e) => setPhysicsBaseTempC(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-sun)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: '0.7rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                    <span>10°C (Đông lạnh)</span>
                    <span>15°C (Chuẩn ISA)</span>
                    <span>26°C (Bình thường)</span>
                    <span>38°C (Hè nóng)</span>
                  </div>
                </div>
              </div>

              {/* 4 Key ISA Physics Telemetry KPI Cells */}
              <div className="editorial-stat-strip">
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Nhiệt Độ Đỉnh Ước Tính
                  </span>
                  <strong
                    style={{
                      fontSize: '1.25rem',
                      color: altitudePhysics.summitTempC <= 8 ? 'var(--color-sky)' : 'var(--color-text-main)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {altitudePhysics.summitTempC.toFixed(1)}°C
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Chênh lệch {altitudePhysics.tempLapseDropC.toFixed(1)}°C (-6,5°C/1.000m)
                  </span>
                </div>

                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Áp Suất Khí Quyển
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {altitudePhysics.pressureHpa.toFixed(1)} hPa
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {altitudePhysics.pressurePctSeaLevel.toFixed(1)}% chuẩn 1.013,3 hPa
                  </span>
                </div>

                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Điểm Sôi Nước Thực Tế
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
                    {altitudePhysics.boilingPointC.toFixed(1)}°C
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Đun sôi tối thiểu {altitudePhysics.recommendedBoilMinutes} phút (WHO/CDC)
                  </span>
                </div>

                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Oxy Hiệu Dụng (pO₂)
                  </span>
                  <strong
                    style={{
                      fontSize: '1.25rem',
                      color:
                        altitudePhysics.amsRiskLevel === 'high'
                          ? 'var(--color-error-text, var(--color-error))'
                          : altitudePhysics.amsRiskLevel === 'moderate'
                            ? 'var(--color-earth)'
                            : 'var(--color-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {altitudePhysics.oxygenPctSeaLevel.toFixed(1)}%
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    {altitudePhysics.amsLabel}
                  </span>
                </div>
              </div>

              {/* Pure-SVG Altitude vs Boiling Point & Effective Oxygen Curve (0m -> 3,200m) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    Biểu Đồ Đối Chiếu Cao Độ Việt Nam (0m → 3.143m Fansipan)
                  </span>
                  <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 3, borderRadius: 2, background: 'var(--color-earth)', display: 'inline-block' }} />
                      Điểm sôi (°C)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 3, borderRadius: 2, background: 'var(--color-sky)', display: 'inline-block' }} />
                      Oxy hiệu dụng (%)
                    </span>
                  </div>
                </div>

                <svg
                  viewBox="0 0 640 166"
                  width="100%"
                  style={{ height: 'auto', display: 'block' }}
                  role="img"
                  aria-label={`Biểu đồ điểm sôi ${altitudePhysics.boilingPointC.toFixed(1)} độ C và oxy ${altitudePhysics.oxygenPctSeaLevel.toFixed(1)} phần trăm tại cao độ ${altitudePhysics.altitudeM} mét`}
                >
                  {/* Aligned horizontal gridlines matching Left Boiling (100/94/88 C) & Right O2 (100/83/65%) */}
                  {[24, 70, 116].map((gy) => (
                    <line
                      key={gy}
                      x1={44}
                      y1={gy}
                      x2={592}
                      y2={gy}
                      stroke="var(--color-border)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  ))}
                  {/* 2,500m AMS threshold zone */}
                  <rect
                    x={44 + (2500 / 3200) * 548}
                    y={20}
                    width={((3200 - 2500) / 3200) * 548}
                    height={98}
                    fill="var(--color-error)"
                    fillOpacity="0.08"
                  />
                  <text
                    x={44 + (2500 / 3200) * 548 + 5}
                    y={34}
                    fill="var(--color-error-text, var(--color-error))"
                    fontSize="10"
                    fontWeight="700"
                    style={{ fontFamily: 'var(--font-family)' }}
                  >
                    AMS &gt;= 2.500m
                  </text>

                  {/* Boiling Point Curve (88 C -> 100 C mapped strictly to y 116 -> 24) */}
                  <polyline
                    fill="none"
                    stroke="var(--color-earth)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={physicsBenchmarks
                      .map((bm) => {
                        const x = 44 + (bm.altitudeM / 3200) * 548;
                        const y = 116 - ((bm.metrics.boilingPointC - 88) / 12) * 92;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />

                  {/* Oxygen Availability Curve (65% -> 100% mapped strictly to y 116 -> 24) */}
                  <polyline
                    fill="none"
                    stroke="var(--color-sky)"
                    strokeWidth="2.2"
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={physicsBenchmarks
                      .map((bm) => {
                        const x = 44 + (bm.altitudeM / 3200) * 548;
                        const y = 116 - ((bm.metrics.oxygenPctSeaLevel - 65) / 35) * 92;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />

                  {/* Benchmark dots + altitude labels */}
                  {physicsBenchmarks.map((bm) => {
                    const bx = 44 + (bm.altitudeM / 3200) * 548;
                    const byBoil = 116 - ((bm.metrics.boilingPointC - 88) / 12) * 92;
                    return (
                      <g key={bm.id}>
                        <circle cx={bx} cy={byBoil} r="3.5" fill="var(--color-earth)" />
                        <text
                          x={bx}
                          y={137}
                          textAnchor={bm.altitudeM === 0 ? 'start' : bm.altitudeM >= 3100 ? 'end' : 'middle'}
                          fill="var(--color-text-dim)"
                          fontSize="10.5"
                          fontWeight="600"
                          style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {bm.altitudeM.toLocaleString('vi-VN')}m
                        </text>
                        <text
                          x={bx}
                          y={153}
                          textAnchor={bm.altitudeM === 0 ? 'start' : bm.altitudeM >= 3100 ? 'end' : 'middle'}
                          fill="var(--color-text-muted)"
                          fontSize="10"
                          style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {bm.metrics.boilingPointC.toFixed(1)}°C
                        </text>
                      </g>
                    );
                  })}

                  {/* Active User Altitude Cursor */}
                  {(() => {
                    const clamped = Math.max(0, Math.min(3200, altitudePhysics.altitudeM));
                    const cx = 44 + (clamped / 3200) * 548;
                    const cyBoil = Math.max(24, Math.min(116, 116 - ((altitudePhysics.boilingPointC - 88) / 12) * 92));
                    const cyO2 = Math.max(24, Math.min(116, 116 - ((altitudePhysics.oxygenPctSeaLevel - 65) / 35) * 92));
                    return (
                      <g>
                        <line
                          x1={cx}
                          y1={20}
                          x2={cx}
                          y2={120}
                          stroke="var(--color-primary)"
                          strokeWidth="1.8"
                        />
                        <circle cx={cx} cy={cyBoil} r="5.5" fill="var(--color-earth)" stroke="var(--color-bg-main)" strokeWidth="2" />
                        <circle cx={cx} cy={cyO2} r="4.5" fill="var(--color-sky)" stroke="var(--color-bg-main)" strokeWidth="2" />
                      </g>
                    );
                  })()}

                  {/* Left Y-axis ticks (Boiling C — aligned to y = 24, 70, 116) */}
                  <text x="38" y="27.5" textAnchor="end" fill="var(--color-text-dim)" fontSize="10.5" style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>100°</text>
                  <text x="38" y="73.5" textAnchor="end" fill="var(--color-text-dim)" fontSize="10.5" style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>94°</text>
                  <text x="38" y="119.5" textAnchor="end" fill="var(--color-text-dim)" fontSize="10.5" style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>88°</text>

                  {/* Right Y-axis ticks (Effective O2 % — aligned to y = 24, 70, 116) */}
                  <text x="598" y="27.5" textAnchor="start" fill="var(--color-sky)" fontSize="10.5" style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>100%</text>
                  <text x="598" y="73.5" textAnchor="start" fill="var(--color-sky)" fontSize="10.5" style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>83%</text>
                  <text x="598" y="119.5" textAnchor="start" fill="var(--color-sky)" fontSize="10.5" style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>65%</text>
                </svg>
              </div>

              {/* Practical Alpine Cooking + AMS Advisory */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 6,
                  background:
                    altitudePhysics.altitudeM >= 2500
                      ? 'var(--banner-danger-bg)'
                      : 'var(--color-surface-elevated)',
                  border: `1px solid ${altitudePhysics.altitudeM >= 2500
                    ? 'var(--banner-danger-border)'
                    : 'var(--color-border)'
                    }`,
                  color:
                    altitudePhysics.altitudeM >= 2500
                      ? 'var(--banner-danger-text)'
                      : 'var(--color-text-main)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: '0.81rem',
                  lineHeight: 1.55,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700 }}>
                  <IconFlame size={15} />
                  Khuyến Nghị Đun Nước & Sinh Lý Độ Cao ({altitudePhysics.altitudeM.toLocaleString('vi-VN')}m)
                </div>
                <p style={{ margin: 0 }}>{altitudePhysics.cookingGuidance}</p>
                <p style={{ margin: 0, opacity: 0.92 }}>{altitudePhysics.amsGuidance}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MẶT TRỜI, GIỜ VÀNG & SĂN MÂY (NOAA OFFLINE)                */}
        {/* ================================================================= */}
        {activeTab === 'solar' && (
          <div className="tab-content-slide" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Peak & Date Controls */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="hub-grid-4">
                <div>
                  <label className="form-label" htmlFor="solar-peak-select" style={{ display: 'block', marginBottom: 5 }}>
                    Chọn đỉnh núi LOST ({trails.length} đỉnh)
                  </label>
                  <select
                    id="solar-peak-select"
                    value={solarTrailId}
                    onChange={(e) => handleSelectSolarTrail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-surface-elevated)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <option value="custom">Tọa độ tùy chỉnh</option>
                    {trails.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name} ({tr.maxAltitudeM}m)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="solar-date" style={{ display: 'block', marginBottom: 5 }}>
                    Ngày săn mây (UTC+7)
                  </label>
                  <input
                    id="solar-date"
                    type="date"
                    value={solarDateIso}
                    onChange={(e) => setSolarDateIso(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="solar-lat" style={{ display: 'block', marginBottom: 5 }}>
                    Vĩ độ (Lat)
                  </label>
                  <input
                    id="solar-lat"
                    type="number"
                    step="0.001"
                    value={solarLat}
                    onChange={(e) => {
                      setSolarTrailId('custom');
                      setSolarLat(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="solar-lng" style={{ display: 'block', marginBottom: 5 }}>
                    Kinh độ (Lng)
                  </label>
                  <input
                    id="solar-lng"
                    type="number"
                    step="0.001"
                    value={solarLng}
                    onChange={(e) => {
                      setSolarTrailId('custom');
                      setSolarLng(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
              </div>

              {/* NOAA Key Time Readouts */}
              <div className="editorial-stat-strip">
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Bình Minh Dân Dụng (Blue)
                  </span>
                  <strong style={{ fontSize: '1.18rem', color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                    {solarData.civilDawn}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Có mặt đỉnh trước giờ này</span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Mặt Trời Mọc (Sunrise)
                  </span>
                  <strong style={{ fontSize: '1.18rem', color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums' }}>
                    {solarData.sunrise}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Phương vị {solarData.sunriseAzimuthDeg}° ({getCardinalDirectionLabel(solarData.sunriseAzimuthDeg).split(' ')[0]})
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Giờ Vàng Sáng (Golden)
                  </span>
                  <strong style={{ fontSize: '1.12rem', color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
                    {solarData.sunrise} – {solarData.goldenHourMorningEnd}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Ánh sáng vàng săn mây</span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Đỉnh Trưa (Solar Noon)
                  </span>
                  <strong style={{ fontSize: '1.18rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {solarData.solarNoon}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Góc cao cực đại {solarData.solarNoonAltitudeDeg}°
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Giờ Vàng Chiều & Hoàng Hôn
                  </span>
                  <strong style={{ fontSize: '1.12rem', color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
                    {solarData.goldenHourEveningStart} – {solarData.sunset}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Lặn tại {solarData.sunsetAzimuthDeg}°
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    Chạng Vạng / Thời Lượng Ngày
                  </span>
                  <strong style={{ fontSize: '1.12rem', color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                    {solarData.civilDusk}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Ban ngày {formatDayLengthVi(solarData.dayLengthMinutes)}
                  </span>
                </div>
              </div>
            </div>

            <div className="hub-grid-2">
              {/* Pure-SVG Solar Arc Diagram */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      Biểu Đồ Cung Quỹ Đạo Mặt Trời (NOAA)
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Tại {formatHoursToHHMM(solarInspectHour)} (UTC+7): Góc cao {solarData.currentSunAltitudeDeg}° • Phương vị {solarData.currentSunAzimuthDeg}°
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                    onClick={() => setSolarInspectHour(getCurrentVietnamDecimalHour())}
                  >
                    <IconClock size={14} />
                    Giờ hiện tại
                  </button>
                </div>

                <svg
                  viewBox={`0 0 ${solarSvgGeometry.W} ${solarSvgGeometry.H}`}
                  width="100%"
                  role="img"
                  aria-label="Biểu đồ quỹ đạo Mặt Trời trong ngày theo giờ Việt Nam"
                  style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}
                >
                  <defs>
                    <linearGradient id={`sunArea-${svgUid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-sun)" stopOpacity="0.34" />
                      <stop offset="100%" stopColor="var(--color-sun)" stopOpacity="0.03" />
                    </linearGradient>
                  </defs>

                  {/* Night Band below Horizon */}
                  <rect
                    x={solarSvgGeometry.padL}
                    y={solarSvgGeometry.horizonY}
                    width={solarSvgGeometry.plotW}
                    height={solarSvgGeometry.H - solarSvgGeometry.padB - solarSvgGeometry.horizonY}
                    fill="color-mix(in srgb, var(--color-sky) 8%, transparent)"
                  />

                  {/* Morning & Evening Golden Hour Highlight Strips */}
                  <rect
                    x={solarSvgGeometry.goldenAmX1}
                    y={solarSvgGeometry.padT}
                    width={Math.max(4, solarSvgGeometry.goldenAmX2 - solarSvgGeometry.goldenAmX1)}
                    height={solarSvgGeometry.horizonY - solarSvgGeometry.padT}
                    fill="color-mix(in srgb, var(--color-earth) 16%, transparent)"
                  />
                  <rect
                    x={solarSvgGeometry.goldenPmX1}
                    y={solarSvgGeometry.padT}
                    width={Math.max(4, solarSvgGeometry.goldenPmX2 - solarSvgGeometry.goldenPmX1)}
                    height={solarSvgGeometry.horizonY - solarSvgGeometry.padT}
                    fill="color-mix(in srgb, var(--color-earth) 16%, transparent)"
                  />

                  {/* Altitude Gridlines */}
                  {[0, 30, 60, 90].map((alt) => {
                    const y = solarSvgGeometry.toY(alt);
                    return (
                      <g key={alt}>
                        <line
                          x1={solarSvgGeometry.padL}
                          y1={y}
                          x2={solarSvgGeometry.W - solarSvgGeometry.padR}
                          y2={y}
                          stroke={alt === 0 ? 'var(--color-border-strong)' : 'var(--color-border)'}
                          strokeWidth={alt === 0 ? 1.5 : 1}
                          strokeDasharray={alt === 0 ? undefined : '3 4'}
                        />
                        <text
                          x={solarSvgGeometry.padL - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="var(--color-text-dim)"
                          fontSize="10"
                          style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {alt}°
                        </text>
                      </g>
                    );
                  })}

                  {/* Hour Axis Labels */}
                  {[0, 4, 8, 12, 16, 20, 24].map((h) => {
                    const x = solarSvgGeometry.toX(h);
                    return (
                      <g key={h}>
                        <line
                          x1={x}
                          y1={solarSvgGeometry.padT}
                          x2={x}
                          y2={solarSvgGeometry.H - solarSvgGeometry.padB}
                          stroke="var(--color-border)"
                          strokeWidth="0.8"
                        />
                        <text
                          x={x}
                          y={solarSvgGeometry.H - 12}
                          textAnchor="middle"
                          fill="var(--color-text-muted)"
                          fontSize="10"
                          style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {String(h).padStart(2, '0')}h
                        </text>
                      </g>
                    );
                  })}

                  {/* Daylight Shaded Polygon */}
                  <polygon points={solarSvgGeometry.daylightAreaPoints} fill={`url(#sunArea-${svgUid})`} />

                  {/* Full Solar Path Curve */}
                  <polyline
                    points={solarSvgGeometry.pointsStr}
                    fill="none"
                    stroke="var(--color-sun)"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Sunrise / Noon / Sunset Markers */}
                  <circle cx={solarSvgGeometry.sunriseX} cy={solarSvgGeometry.horizonY} r="4" fill="var(--color-earth)" />
                  <text
                    x={solarSvgGeometry.sunriseX}
                    y={solarSvgGeometry.horizonY + 14}
                    textAnchor="middle"
                    fill="var(--color-earth)"
                    fontSize="9.5"
                    fontWeight="700"
                    style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {solarData.sunrise}
                  </text>

                  <circle cx={solarSvgGeometry.sunsetX} cy={solarSvgGeometry.horizonY} r="4" fill="var(--color-earth)" />
                  <text
                    x={solarSvgGeometry.sunsetX}
                    y={solarSvgGeometry.horizonY + 14}
                    textAnchor="middle"
                    fill="var(--color-earth)"
                    fontSize="9.5"
                    fontWeight="700"
                    style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {solarData.sunset}
                  </text>

                  <circle cx={solarSvgGeometry.noonX} cy={solarSvgGeometry.noonY} r="3.5" fill="var(--color-primary)" />
                  <text
                    x={solarSvgGeometry.noonX}
                    y={Math.max(16, solarSvgGeometry.noonY - 8)}
                    textAnchor="middle"
                    fill="var(--color-text-main)"
                    fontSize="9.5"
                    fontWeight="700"
                    style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {solarData.solarNoon} ({solarData.solarNoonAltitudeDeg}°)
                  </text>

                  {/* Active Scrubber Sun Position */}
                  <line
                    x1={solarSvgGeometry.currentX}
                    y1={solarSvgGeometry.padT}
                    x2={solarSvgGeometry.currentX}
                    y2={solarSvgGeometry.H - solarSvgGeometry.padB}
                    stroke="var(--color-primary)"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={solarSvgGeometry.currentX}
                    cy={solarSvgGeometry.currentY}
                    r="6.5"
                    fill="var(--color-bg-card)"
                    stroke="var(--color-primary)"
                    strokeWidth="2.5"
                  />
                </svg>

                {/* Time Scrubber */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    <span>Kéo thanh giờ để mô phỏng vị trí Mặt Trời</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatHoursToHHMM(solarInspectHour)} UTC+7
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={23.75}
                    step={0.25}
                    value={solarInspectHour}
                    aria-label="Giờ kiểm tra quỹ đạo Mặt Trời"
                    onChange={(e) => setSolarInspectHour(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-sun)' }}
                  />
                </div>
              </div>

              {/* Sea-of-Clouds Tactical Readiness Checklist */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                      Kiểm Tra Điều Kiện Săn Biển Mây
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {sunriseCountdownLabel}
                    </p>
                  </div>
                  <span
                    className={`badge ${cloudReadinessScore >= 75
                      ? 'badge-success'
                      : cloudReadinessScore >= 50
                        ? 'badge-sun'
                        : 'badge-warning'
                      }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    <IconCloud size={13} />
                    Khả năng {cloudReadinessScore}%
                  </span>
                </div>

                {/* Altitude Band & Timing Notice */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Cao độ đỉnh mục tiêu:</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                      {solarAltitudeM.toLocaleString('vi-VN')} m (
                      {solarAltitudeM >= 1800
                        ? 'Đai săn mây lý tưởng >1.800m'
                        : solarAltitudeM >= 1200
                          ? 'Đai sương mù thung lũng'
                          : 'Núi thấp — ưu tiên đón bình minh'}
                      )
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Khung giờ xuất phát từ lán:</span>
                    <strong style={{ color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      Trước {formatHoursToHHMM(Math.max(0, solarData.civilDawnHours - 0.75))} (tới đỉnh trước {solarData.civilDawn})
                    </strong>
                  </div>
                </div>

                {/* Readiness Bar */}
                <div style={{ height: 8, width: '100%', background: 'var(--color-surface-elevated)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${cloudReadinessScore}%`,
                      background:
                        cloudReadinessScore >= 75
                          ? 'var(--color-primary)'
                          : cloudReadinessScore >= 50
                            ? 'var(--color-sun)'
                            : 'var(--color-earth)',
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>

                {/* Interactive Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {CLOUD_CHECKLIST_ITEMS.map((item) => {
                    const checked = Boolean(cloudChecks[item.id]);
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '9px 11px',
                          borderRadius: 4,
                          border: `1px solid ${checked ? 'var(--color-border-glow)' : 'var(--color-border)'}`,
                          background: checked
                            ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                            : 'var(--color-bg-main)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={item.title}
                          checked={checked}
                          onChange={(e) =>
                            setCloudChecks((prev) => ({
                              ...prev,
                              [item.id]: e.target.checked,
                            }))
                          }
                          style={{ marginTop: 3, accentColor: 'var(--color-primary)' }}
                        />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--color-text-main)' }}>{item.title}</strong>
                          <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                            {item.detail}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: NƯỚC, CALO & BALO (BIO-CALC ONLINE + INSTANT OFFLINE)      */}
        {/* ================================================================= */}
        {activeTab === 'bio' && (
          <div className="tab-content-slide hub-grid-2">
            {/* Interactive Controls */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Thông Số Chuyến Đi & Thể Trạng
                </h2>
                <span className={`badge ${bioSource === 'server' ? 'badge-success' : 'badge-info'}`}>
                  {bioSyncing
                    ? 'Đang đồng bộ...'
                    : bioSource === 'server'
                      ? 'Máy chủ LOST (/api/ai/bio-calc)'
                      : 'Tính toán Offline 0ms'}
                </span>
              </div>

              <div>
                <label className="form-label" htmlFor="bio-trail-preset" style={{ display: 'block', marginBottom: 5 }}>
                  Nạp thông số từ {trails.length} cung LOST (hoặc tùy chỉnh tự do)
                </label>
                <select
                  id="bio-trail-preset"
                  value={bioTrailId}
                  onChange={(e) => handleSelectBioTrail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-strong)',
                    background: 'var(--color-surface-elevated)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.84rem',
                  }}
                >
                  <option value="custom">Tự nhập thông số thực tế</option>
                  {trails.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} — {tr.distanceKm} km / +{tr.elevationGainM}m / {tr.maxAltitudeM}m
                    </option>
                  ))}
                </select>
              </div>

              {/* Sliders Grid */}
              <div className="hub-grid-2" style={{ gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Cự ly cung đường</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{bioDistanceKm} km</strong>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={80}
                    step={0.5}
                    value={bioDistanceKm}
                    aria-label="Cự ly cung đường (km)"
                    onChange={(e) => {
                      setBioTrailId('custom');
                      setBioDistanceKm(Number(e.target.value));
                    }}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Độ cao leo tích lũy</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>+{bioGainM} m</strong>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={4000}
                    step={50}
                    value={bioGainM}
                    aria-label="Độ cao leo tích lũy (m)"
                    onChange={(e) => {
                      setBioTrailId('custom');
                      setBioGainM(Number(e.target.value));
                    }}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Cao độ đỉnh tối đa</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{bioMaxAltM} m</strong>
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={3200}
                    step={50}
                    value={bioMaxAltM}
                    aria-label="Cao độ đỉnh (m)"
                    onChange={(e) => {
                      setBioTrailId('custom');
                      setBioMaxAltM(Number(e.target.value));
                    }}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Số ngày di chuyển</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{bioDays} ngày</strong>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    step={1}
                    value={bioDays}
                    aria-label="Số ngày di chuyển"
                    onChange={(e) => setBioDays(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Cân nặng cơ thể</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{bioBodyWeightKg} kg</strong>
                  </div>
                  <input
                    type="range"
                    min={38}
                    max={120}
                    step={1}
                    value={bioBodyWeightKg}
                    aria-label="Cân nặng cơ thể (kg)"
                    onChange={(e) => setBioBodyWeightKg(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-sky)' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Trọng lượng balo</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{bioPackWeightKg} kg</strong>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={28}
                    step={0.5}
                    value={bioPackWeightKg}
                    aria-label="Trọng lượng balo (kg)"
                    onChange={(e) => setBioPackWeightKg(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-earth)' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Nhiệt độ môi trường</span>
                    <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{bioTempC}°C</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={bioTempC}
                    aria-label="Nhiệt độ môi trường"
                    onChange={(e) => setBioTempC(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-sun)' }}
                  />
                </div>

                <div>
                  <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Trình độ thể lực
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {(
                      [
                        { id: 'beginner', label: 'Mới đi' },
                        { id: 'intermediate', label: 'Trung bình' },
                        { id: 'advanced', label: 'Chuyên sâu' },
                      ] as const
                    ).map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        className={bioFitness === lvl.id ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => setBioFitness(lvl.id)}
                        style={{ padding: '7px 6px', fontSize: '0.76rem' }}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Results + Pack-to-Body Ratio SVG Safety Gauge + AMS Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Key Bio Telemetry */}
              <div className="editorial-stat-strip">
                <div className="editorial-stat-cell">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--color-sky)', textTransform: 'uppercase', fontWeight: 700 }}>
                    <IconDroplet size={13} />
                    Nước Uống / Ngày
                  </span>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {activeBioMetrics.waterLitersPerDay} L/ngày
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Tổng chuyến: {activeBioMetrics.waterLitersTotal}L
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Điện Giải Oresol
                  </span>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {activeBioMetrics.oresolPackets} gói
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>Pha đúng tỷ lệ chống chuột rút</span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--color-earth)', textTransform: 'uppercase', fontWeight: 700 }}>
                    <IconFlame size={13} />
                    Năng Lượng / Ngày
                  </span>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {activeBioMetrics.caloriesDailyTotalKcal.toLocaleString('vi-VN')} kcal
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Vận động: {activeBioMetrics.caloriesActiveKcal.toLocaleString('vi-VN')} kcal
                  </span>
                </div>
                <div className="editorial-stat-cell">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--color-sun)', textTransform: 'uppercase', fontWeight: 700 }}>
                    <IconClock size={13} />
                    Thời Gian Di Chuyển
                  </span>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {activeBioMetrics.recommendedMovingHours} giờ
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Naismith {activeBioMetrics.naismithHours}h | Tobler {activeBioMetrics.toblerHours}h
                  </span>
                </div>
              </div>

              {/* Pack-to-Body Ratio % SVG Safety Gauge */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    Đồng Hồ An Toàn Tỷ Lệ Tải Balo / Thể Trọng
                  </h3>
                  <span
                    className={`badge ${activeBioMetrics.packStatus === 'optimal'
                      ? 'badge-success'
                      : activeBioMetrics.packStatus === 'caution'
                        ? 'badge-sun'
                        : 'badge-error'
                      }`}
                  >
                    {activeBioMetrics.packStatus === 'optimal'
                      ? 'Tối ưu (<= 18%)'
                      : activeBioMetrics.packStatus === 'caution'
                        ? 'Cảnh báo (18–22%)'
                        : 'Quá tải (> 22%)'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
                  <svg
                    viewBox="0 0 260 148"
                    width="230"
                    role="img"
                    aria-label={`Tỷ lệ tải balo ${activeBioMetrics.packRatioPercent} phần trăm cơ thể`}
                    style={{ flexShrink: 0, maxWidth: '100%', height: 'auto', display: 'block' }}
                  >
                    {/* Base track */}
                    <path d={packGaugeGeometry.optimalPath} fill="none" stroke="var(--color-primary)" strokeWidth="14" strokeLinecap="butt" />
                    <path d={packGaugeGeometry.cautionPath} fill="none" stroke="var(--color-sun)" strokeWidth="14" strokeLinecap="butt" />
                    <path d={packGaugeGeometry.overweightPath} fill="none" stroke="var(--color-error)" strokeWidth="14" strokeLinecap="butt" />

                    {/* Scale labels */}
                    <text x="26" y="138" fill="var(--color-text-dim)" fontSize="10" style={{ fontFamily: 'var(--font-family)' }}>0%</text>
                    <text x="128" y="20" textAnchor="middle" fill="var(--color-text-dim)" fontSize="10" style={{ fontFamily: 'var(--font-family)' }}>18%</text>
                    <text x="234" y="138" textAnchor="end" fill="var(--color-text-dim)" fontSize="10" style={{ fontFamily: 'var(--font-family)' }}>35%</text>

                    {/* Needle */}
                    <line
                      x1={packGaugeGeometry.cx}
                      y1={packGaugeGeometry.cy}
                      x2={packGaugeGeometry.nx.toFixed(1)}
                      y2={packGaugeGeometry.ny.toFixed(1)}
                      stroke={packGaugeGeometry.statusColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <circle cx={packGaugeGeometry.cx} cy={packGaugeGeometry.cy} r="6.5" fill={packGaugeGeometry.statusColor} />

                    {/* Numeric Value */}
                    <text
                      x={packGaugeGeometry.cx}
                      y="102"
                      textAnchor="middle"
                      fill="var(--color-text-main)"
                      fontSize="22"
                      fontWeight="800"
                      style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {activeBioMetrics.packRatioPercent}%
                    </text>
                  </svg>

                  <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: '0.86rem', color: 'var(--color-text-main)', fontWeight: 600, lineHeight: 1.5 }}>
                      {activeBioMetrics.packAdvice}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Ngưỡng khuyến nghị tối ưu cho cơ thể {bioBodyWeightKg} kg: <strong>&lt;= {(bioBodyWeightKg * 0.18).toFixed(1)} kg</strong> (tối đa an toàn {(bioBodyWeightKg * 0.22).toFixed(1)} kg).
                    </p>
                    <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {activeBioMetrics.snackPlan.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* AMS High-Altitude Advisory Card (>= 2,500m) */}
              {bioMaxAltM >= 2500 ? (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 6,
                    background: 'var(--banner-danger-bg)',
                    border: '1px solid var(--banner-danger-border)',
                    color: 'var(--banner-danger-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.92rem' }}>
                    <IconAlertTriangle size={18} />
                    Cảnh Báo Độ Cao & Phòng Chống Sốc Độ Cao AMS ({bioMaxAltM.toLocaleString('vi-VN')}m)
                  </div>
                  <p style={{ fontSize: '0.84rem', lineHeight: 1.55 }}>{activeBioMetrics.amsAdvice}</p>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.8rem', lineHeight: 1.55 }}>
                    <li>Duy trì nhịp thở đều 2:2 và bước nghỉ (Rest Step) khi vượt dốc trên 2.500m.</li>
                    <li>Uống nước ấm pha điện giải từng ngụm nhỏ, tuyệt đối không dùng rượu bia tại lán đêm.</li>
                    <li>Nếu xuất hiện đau đầu dữ dội kèm buồn nôn, choáng váng hoặc khó thở khi nghỉ: lập tức HẠ CAO ĐỘ 300m–500m.</li>
                  </ul>
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.82rem',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <IconMountain size={18} color="var(--color-primary)" />
                  <span>{activeBioMetrics.amsAdvice}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: SOS 2G & TÍN HIỆU KHẨN CẤP                                 */}
        {/* ================================================================= */}
        {activeTab === 'sos' && (
          <div className="tab-content-slide" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* National 24/7 Quick-Dial Strip */}
            <div className="hub-grid-4">
              {nationalHotlines.map((hotline) => {
                const dial = extractPrimaryDialNumber(hotline.hotlinePhone);
                return (
                  <a
                    key={hotline.slug}
                    href={`tel:${dial}`}
                    className="card"
                    style={{
                      textDecoration: 'none',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      borderColor: 'color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))', textTransform: 'uppercase' }}>
                        Khẩn Cấp 24/7
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                        {hotline.hotlinePhone}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                        {hotline.name.replace(/\s*\(\d+\)/, '')}
                      </div>
                    </div>
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 6,
                        background: 'var(--color-error)',
                        color: 'var(--color-on-danger)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconPhoneCall size={18} />
                    </span>
                  </a>
                );
              })}
            </div>

            <div className="hub-grid-2">
              {/* Left Column: GPS Lock + 2G SMS Composer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      1. Khóa GPS & Soạn Tin Nhắn SOS 2G (Không Cần Mạng)
                    </h2>
                    <span className={`badge ${gpsAccuracyMeta.badgeClass}`}>{gpsAccuracyMeta.label}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleLockGps}
                      disabled={gpsLoading}
                    >
                      <IconCrosshairSvg size={15} />
                      {gpsLoading ? 'Đang định vị vệ tinh...' : 'Cập nhật GPS Hiện Tại'}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Đang dùng: <strong>{referenceSosCoords.lat.toFixed(5)}, {referenceSosCoords.lng.toFixed(5)}</strong> ({referenceSosCoords.label})
                    </span>
                  </div>

                  <div className="hub-grid-2" style={{ gap: 10 }}>
                    <div>
                      <label className="form-label" htmlFor="sos-phone-input" style={{ display: 'block', marginBottom: 4 }}>
                        Số điện thoại nhận SOS (2G SMS)
                      </label>
                      <input
                        id="sos-phone-input"
                        type="tel"
                        value={sosPhone}
                        onChange={(e) => setSosPhone(e.target.value)}
                        placeholder="112 hoặc số Trạm Kiểm lâm / Người thân"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="sos-trail-input" style={{ display: 'block', marginBottom: 4 }}>
                        Cung đường / Khu vực hiện tại
                      </label>
                      <input
                        id="sos-trail-input"
                        type="text"
                        value={sosTrailName}
                        onChange={(e) => setSosTrailName(e.target.value)}
                        placeholder="VD: Fansipan - Lán 2.800m"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Incident Chips */}
                  <div>
                    <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Chọn nhanh tình trạng khẩn cấp
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {SOS_QUICK_NOTES.map((noteOpt) => (
                        <button
                          key={noteOpt}
                          type="button"
                          className={sosNote === noteOpt ? 'btn btn-danger' : 'btn btn-secondary'}
                          onClick={() => setSosNote(noteOpt)}
                          style={{ padding: '5px 9px', fontSize: '0.74rem' }}
                        >
                          {noteOpt.split(',')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="form-label" htmlFor="sos-note-area" style={{ display: 'block', marginBottom: 4 }}>
                      Ghi chú tình trạng (không dấu để tương thích tốt nhất trên sóng 2G)
                    </label>
                    <textarea
                      id="sos-note-area"
                      rows={2}
                      value={sosNote}
                      onChange={(e) => setSosNote(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Exact SMS Preview */}
                  <pre
                    style={{
                      margin: 0,
                      padding: '10px 12px',
                      borderRadius: 4,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.78rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'var(--font-family)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {smsPayload.body}
                  </pre>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a href={smsPayload.uri} className="btn btn-danger" style={{ flex: 1, minWidth: 190 }}>
                      <IconSend size={15} />
                      Mở Ứng Dụng SMS 2G Gửi Ngay
                    </a>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleCopyText(smsPayload.body, 'nội dung tin nhắn SOS')}
                    >
                      <IconCopy size={15} />
                      Sao chép nội dung
                    </button>
                  </div>
                </div>

                {/* Visual SOS Strobe & 3.1kHz Rescue Whistle */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    2. Tín Hiệu Ánh Sáng & Còi Cứu Hộ 3.1 kHz (Morse SOS)
                  </h2>

                  {/* Visual Morse Indicator Bars (Pure SVG, zero emojis) */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 4,
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      Nhịp Morse Quốc Tế (S - O - S)
                    </span>
                    <svg viewBox="0 0 216 16" width="216" height="16" aria-hidden="true">
                      {[
                        { idx: 0, x: 4, w: 12 },
                        { idx: 1, x: 22, w: 12 },
                        { idx: 2, x: 40, w: 12 },
                        { idx: 3, x: 66, w: 28 },
                        { idx: 4, x: 100, w: 28 },
                        { idx: 5, x: 134, w: 28 },
                        { idx: 6, x: 174, w: 12 },
                        { idx: 7, x: 190, w: 12 },
                        { idx: 8, x: 204, w: 12 },
                      ].map((s) => {
                        const isLit = whistleSymbolIdx === s.idx || strobeSymbolIdx === s.idx;
                        return (
                          <rect
                            key={s.idx}
                            x={s.x}
                            y={3}
                            width={s.w}
                            height={10}
                            rx={3}
                            fill={isLit ? 'var(--color-error)' : 'var(--color-border-strong)'}
                          />
                        );
                      })}
                    </svg>
                  </div>

                  {/* Controls */}
                  <div className="hub-grid-2" style={{ gap: 12 }}>
                    {/* Visual Strobe Control */}
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 4,
                        background: 'var(--color-surface-elevated)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>
                        <IconFlashlightSvg size={16} />
                        Đèn Chớp Màn Hình SOS
                      </div>
                      <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                        Phát sáng toàn màn hình nhịp Morse SOS để đội tìm kiếm phát hiện trong đêm. Bấm Dừng hoặc phím Esc để tắt ngay.
                      </p>
                      <button
                        type="button"
                        className={strobeActive ? 'btn btn-danger' : 'btn btn-earth'}
                        onClick={() => setStrobeActive((prev) => !prev)}
                      >
                        <IconFlashlightSvg size={15} />
                        {strobeActive ? 'Dừng Đèn SOS' : 'Bật Đèn Chớp SOS Toàn Màn Hình'}
                      </button>
                    </div>

                    {/* 3.1kHz Alpine Whistle Control */}
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 4,
                        background: 'var(--color-surface-elevated)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>
                        <IconVolumeSvg size={16} />
                        Còi Cứu Hộ 3.1 kHz (Web Audio)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span>Âm lượng còi</span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(whistleVolume * 100)}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={whistleVolume}
                        aria-label="Âm lượng còi cứu hộ"
                        onChange={(e) => setWhistleVolume(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-error)' }}
                      />
                      <button
                        type="button"
                        className={whistleActive ? 'btn btn-danger' : 'btn btn-primary'}
                        onClick={() => {
                          if (whistleActive) stopRescueWhistle();
                          else startRescueWhistle();
                        }}
                      >
                        <IconWaveform size={15} />
                        {whistleActive ? 'Dừng Còi SOS Ngay' : 'Phát Còi Cứu Hộ 3.1 kHz'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Nearest Verified VQG / Ranger Stations */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 3 }}>
                      Trạm Kiểm Lâm & VQG Xác Thực Gần Nhất
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Tự động sắp xếp theo khoảng cách Haversine từ {referenceSosCoords.label}.
                    </p>
                  </div>
                  <span className="badge badge-success">
                    <IconCheckCircle size={13} />
                    100% Số Xác Thực
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {nearestRangerStations.map(({ station, distanceKm }) => {
                    const primaryDial = extractPrimaryDialNumber(station.hotlinePhone);
                    return (
                      <div
                        key={station.slug}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 6,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-main)', display: 'block', lineHeight: 1.35 }}>
                              {station.name}
                            </strong>
                            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                              {station.district}, {station.province} • {station.officeHours}
                            </span>
                          </div>
                          <span className="badge badge-info" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {distanceKm.toFixed(1)} km
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <a
                            href={`tel:${primaryDial}`}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}
                          >
                            <IconPhone size={14} />
                            Gọi {station.hotlinePhone}
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                            onClick={() => {
                              setSosPhone(primaryDial);
                              onShowToast?.(`Đã chọn ${station.name} làm số nhận SMS 2G.`, 'info');
                            }}
                          >
                            <IconRadio size={14} />
                            Chọn nhận SMS
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                            onClick={() => handleCopyText(primaryDial, station.name)}
                          >
                            <IconCheck size={14} />
                            Chép số
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Offline ICE Emergency Medical Lockscreen PNG Generator (1080x1920) */}
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                borderColor: 'color-mix(in srgb, var(--color-error) 34%, var(--color-border))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2
                    style={{
                      fontSize: '1.06rem',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <IconShieldAlert size={18} color="var(--color-error-text, var(--color-error))" />
                    3. Thẻ Màn Hình Khóa Y Tế Khẩn Cấp (ICE Lockscreen PNG 1080×1920)
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Tạo ảnh hình nền khóa điện thoại hiển thị Nhóm máu, Dị ứng, Bệnh nền, Người thân khẩn cấp & Trạm Kiểm lâm để lực lượng cứu hộ đọc ngay không cần mở mật khẩu máy. Chừa khoảng trống cho đồng hồ khóa iOS/Android.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={iceStorageError ? 'badge badge-error' : 'badge badge-success'}>
                    <IconLock size={13} />
                    {iceStorageError ? 'Chỉ giữ tạm trong phiên' : 'Lưu cục bộ trên thiết bị'}
                  </span>
                  {iceSavedAt && !iceStorageError && (
                    <span style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      Đã tự lưu lúc {iceSavedAt}
                    </span>
                  )}
                </div>
              </div>

              {iceStorageError && (
                <div
                  role="alert"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'var(--banner-danger-bg)',
                    border: '1px solid var(--banner-danger-border)',
                    color: 'var(--banner-danger-text)',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    lineHeight: 1.45,
                  }}
                >
                  <IconAlertTriangle size={16} />
                  <span>{iceStorageError}</span>
                </div>
              )}

              <div className="hub-grid-2" style={{ alignItems: 'start', gap: 18 }}>
                {/* Left Column: Medical & Emergency Contact Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="hub-grid-2" style={{ gap: 10 }}>
                    <div>
                      <label className="form-label" htmlFor="ice-fullname-input" style={{ display: 'block', marginBottom: 4 }}>
                        Họ và tên người leo núi
                      </label>
                      <input
                        id="ice-fullname-input"
                        type="text"
                        maxLength={80}
                        value={iceProfile.fullName}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                        placeholder="VD: Nguyễn Minh Hoàng"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="ice-birthyear-input" style={{ display: 'block', marginBottom: 4 }}>
                        Năm sinh (tùy chọn)
                      </label>
                      <input
                        id="ice-birthyear-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={12}
                        value={iceProfile.birthYear}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({ ...prev, birthYear: e.target.value }))
                        }
                        placeholder="VD: 1996"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>

                  {/* Blood Type Quick Pills */}
                  <div>
                    <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Nhóm máu (hiển thị cỡ lớn góc trên thẻ ICE)
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ICE_BLOOD_TYPES.map((bt) => {
                        const active = iceProfile.bloodType === bt;
                        return (
                          <button
                            key={bt}
                            type="button"
                            aria-pressed={active}
                            className={active ? 'btn btn-danger' : 'btn btn-secondary'}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              minWidth: 46,
                            }}
                            onClick={() =>
                              updateIceProfile((prev) => ({ ...prev, bloodType: bt }))
                            }
                          >
                            {bt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allergies & Medical Conditions */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <label className="form-label" htmlFor="ice-allergies-input" style={{ margin: 0 }}>
                        Dị ứng thuốc / thức ăn / nọc ong rừng
                      </label>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontVariantNumeric: 'tabular-nums',
                          color:
                            iceProfile.allergies.length > 140
                              ? 'var(--color-earth)'
                              : 'var(--color-text-dim)',
                        }}
                      >
                        {iceProfile.allergies.length}/180
                      </span>
                    </div>
                    <input
                      id="ice-allergies-input"
                      type="text"
                      maxLength={180}
                      value={iceProfile.allergies}
                      onChange={(e) =>
                        updateIceProfile((prev) => ({ ...prev, allergies: e.target.value }))
                      }
                      placeholder="VD: Dị ứng Penicillin, dị ứng ong vò vẽ (mang bút tiêm Epinephrine)"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <label className="form-label" htmlFor="ice-conditions-input" style={{ margin: 0 }}>
                        Bệnh nền / Thuốc đang dùng / Lưu ý y tế
                      </label>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontVariantNumeric: 'tabular-nums',
                          color:
                            iceProfile.medicalConditions.length > 160
                              ? 'var(--color-earth)'
                              : 'var(--color-text-dim)',
                        }}
                      >
                        {iceProfile.medicalConditions.length}/200
                      </span>
                    </div>
                    <textarea
                      id="ice-conditions-input"
                      rows={2}
                      maxLength={200}
                      value={iceProfile.medicalConditions}
                      onChange={(e) =>
                        updateIceProfile((prev) => ({ ...prev, medicalConditions: e.target.value }))
                      }
                      placeholder="VD: Hen suyễn nhẹ (ống hít Ventolin trong túi hông trái balo)"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Emergency Contact #1 */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                      Người Liên Hệ Khẩn Cấp #1 (Ưu tiên gọi đầu tiên)
                    </strong>
                    <div className="hub-grid-3" style={{ gap: 8 }}>
                      <input
                        type="text"
                        maxLength={60}
                        aria-label="Họ tên người liên hệ khẩn cấp số 1"
                        value={iceProfile.contact1.name}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({
                            ...prev,
                            contact1: { ...prev.contact1, name: e.target.value },
                          }))
                        }
                        placeholder="Họ tên"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                      <input
                        type="text"
                        maxLength={32}
                        aria-label="Quan hệ người liên hệ khẩn cấp số 1"
                        value={iceProfile.contact1.relation}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({
                            ...prev,
                            contact1: { ...prev.contact1, relation: e.target.value },
                          }))
                        }
                        placeholder="Quan hệ (Bố/Mẹ/Vợ...)"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                      <input
                        type="tel"
                        maxLength={28}
                        aria-label="Số điện thoại người liên hệ khẩn cấp số 1"
                        value={iceProfile.contact1.phone}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({
                            ...prev,
                            contact1: { ...prev.contact1, phone: e.target.value },
                          }))
                        }
                        placeholder="Số điện thoại"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>

                  {/* Emergency Contact #2 */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: '0.8rem', color: 'var(--color-sky)' }}>
                      Người Liên Hệ Khẩn Cấp #2 (Trưởng đoàn / Porter / Dự phòng)
                    </strong>
                    <div className="hub-grid-3" style={{ gap: 8 }}>
                      <input
                        type="text"
                        maxLength={60}
                        aria-label="Họ tên người liên hệ khẩn cấp số 2"
                        value={iceProfile.contact2.name}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({
                            ...prev,
                            contact2: { ...prev.contact2, name: e.target.value },
                          }))
                        }
                        placeholder="Họ tên"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                      <input
                        type="text"
                        maxLength={32}
                        aria-label="Quan hệ người liên hệ khẩn cấp số 2"
                        value={iceProfile.contact2.relation}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({
                            ...prev,
                            contact2: { ...prev.contact2, relation: e.target.value },
                          }))
                        }
                        placeholder="Quan hệ (Leader/Bạn...)"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                      <input
                        type="tel"
                        maxLength={28}
                        aria-label="Số điện thoại người liên hệ khẩn cấp số 2"
                        value={iceProfile.contact2.phone}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({
                            ...prev,
                            contact2: { ...prev.contact2, phone: e.target.value },
                          }))
                        }
                        placeholder="Số điện thoại"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>

                  {/* Planned Peak + Verified Ranger Hotline Sync */}
                  <div className="hub-grid-2" style={{ gap: 10 }}>
                    <div>
                      <label className="form-label" htmlFor="ice-peak-select" style={{ display: 'block', marginBottom: 4 }}>
                        Chọn cung đường LOST ({trails.length} đỉnh)
                      </label>
                      <select
                        id="ice-peak-select"
                        value={icePeakTrailId}
                        onChange={(e) => handleSelectIcePeak(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">-- Chọn cung để tự điền Trạm Kiểm lâm --</option>
                        {trails.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.maxAltitudeM.toLocaleString('vi-VN')}m)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" htmlFor="ice-deadline-input" style={{ display: 'block', marginBottom: 4 }}>
                        Dự kiến hạ sơn (tùy chọn)
                      </label>
                      <input
                        id="ice-deadline-input"
                        type="text"
                        maxLength={44}
                        value={iceProfile.returnDeadline}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({ ...prev, returnDeadline: e.target.value }))
                        }
                        placeholder="VD: 17:00 CN 26/11"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <label className="form-label" htmlFor="ice-planned-peak-input" style={{ margin: 0 }}>
                        Tên cung đường / Đỉnh núi hiển thị trên thẻ (có thể chỉnh tay)
                      </label>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontVariantNumeric: 'tabular-nums',
                          color:
                            iceProfile.plannedPeak.length > 72
                              ? 'var(--color-earth)'
                              : 'var(--color-text-dim)',
                        }}
                      >
                        {iceProfile.plannedPeak.length}/90
                      </span>
                    </div>
                    <input
                      id="ice-planned-peak-input"
                      type="text"
                      maxLength={90}
                      value={iceProfile.plannedPeak}
                      onChange={(e) => {
                        setIcePeakTrailId('');
                        updateIceProfile((prev) => ({ ...prev, plannedPeak: e.target.value }));
                      }}
                      placeholder="VD: Đỉnh Fansipan (3.143m) - Hướng Trạm Tôn"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                  </div>

                  <div className="hub-grid-2" style={{ gap: 10 }}>
                    <div>
                      <label className="form-label" htmlFor="ice-ranger-name" style={{ display: 'block', marginBottom: 4 }}>
                        Trạm Kiểm lâm / BQL VQG phụ trách
                      </label>
                      <input
                        id="ice-ranger-name"
                        type="text"
                        maxLength={100}
                        value={iceProfile.rangerStationName}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({ ...prev, rangerStationName: e.target.value }))
                        }
                        placeholder="VD: BQL VQG Hoàng Liên (Sa Pa)"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="ice-ranger-phone" style={{ display: 'block', marginBottom: 4 }}>
                        Hotline Kiểm lâm xác thực
                      </label>
                      <input
                        id="ice-ranger-phone"
                        type="tel"
                        maxLength={36}
                        value={iceProfile.rangerHotline}
                        onChange={(e) =>
                          updateIceProfile((prev) => ({ ...prev, rangerHotline: e.target.value }))
                        }
                        placeholder="VD: 0214 3871 330 hoặc 112"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-main)',
                          color: 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {nearestRangerStations[0] && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 11px', fontSize: '0.77rem' }}
                        onClick={() => {
                          const nearest = nearestRangerStations[0].station;
                          updateIceProfile((prev) => ({
                            ...prev,
                            plannedPeak: prev.plannedPeak || sosTrailName || referenceSosCoords.label,
                            rangerStationName: nearest.name,
                            rangerHotline: nearest.hotlinePhone,
                          }));
                          onShowToast?.(`Đã gắn trạm gần nhất: ${nearest.name}.`, 'info');
                        }}
                      >
                        <IconRadio size={14} />
                        Gắn trạm gần vị trí hiện tại
                      </button>
                    )}
                    {iceConfirmClear ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '6px 11px', fontSize: '0.77rem' }}
                          onClick={handleClearIceProfile}
                        >
                          <IconTrash size={14} />
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: '0.77rem' }}
                          onClick={() => setIceConfirmClear(false)}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '6px 11px', fontSize: '0.77rem' }}
                        onClick={() => setIceConfirmClear(true)}
                      >
                        <IconTrash size={14} />
                        Xóa hồ sơ ICE cục bộ
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Column: Live 9:16 Lockscreen PNG Preview & Export Controls */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px',
                    borderRadius: 6,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconImage size={15} color="var(--color-primary)" />
                      Xem trước màn hình khóa (9:16)
                    </span>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        aria-pressed={iceTheme === 'dark'}
                        className={iceTheme === 'dark' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                        onClick={() => setIceTheme('dark')}
                      >
                        Nền Tối
                      </button>
                      <button
                        type="button"
                        aria-pressed={iceTheme === 'light'}
                        className={iceTheme === 'light' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                        onClick={() => setIceTheme('light')}
                      >
                        Nền Sáng
                      </button>
                    </div>
                  </div>

                  {/* Phone Aspect Preview Frame */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 280,
                      aspectRatio: '9 / 16',
                      borderRadius: 12,
                      border: '2px solid var(--color-border-strong)',
                      background: 'var(--color-bg-card)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {icePreviewUrl ? (
                      <img
                        src={icePreviewUrl}
                        alt="Xem trước ảnh màn hình khóa y tế khẩn cấp ICE 1080x1920"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          display: 'block',
                          opacity: iceRendering ? 0.72 : 1,
                          transition: 'opacity 0.15s ease',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', padding: 16, textAlign: 'center' }}>
                        {iceError || 'Đang dựng ảnh màn hình khóa ICE 1080×1920...'}
                      </span>
                    )}
                  </div>

                  {iceError && (
                    <p role="alert" style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-error-text, var(--color-error))', textAlign: 'center' }}>
                      {iceError}
                    </p>
                  )}

                  {iceTruncatedFields.length > 0 && (
                    <div
                      role="status"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        background: 'var(--banner-danger-bg)',
                        border: '1px solid var(--banner-danger-border)',
                        color: 'var(--banner-danger-text)',
                        fontSize: '0.74rem',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong>Cảnh báo cắt gọn trên ảnh:</strong> Mục {iceTruncatedFields.join(', ')} hơi dài so với khung 1080×1920 — hãy rút gọn để đội cứu hộ đọc đầy đủ thông tin y tế.
                    </div>
                  )}

                  <span style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                    1080 × 1920 px • Định dạng PNG sắc nét • 100% xử lý trên trình duyệt, không tải dữ liệu y tế lên mạng
                  </span>

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={iceExporting}
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        void handleDownloadIcePng();
                      }}
                    >
                      <IconDownload size={16} />
                      {iceExporting ? 'Đang xuất ảnh PNG...' : 'Tải Ảnh Màn Hình Khóa PNG (1080×1920)'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={iceExporting}
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        void handleShareIcePng();
                      }}
                    >
                      <IconShare size={15} />
                      {iceExporting ? 'Đang chuẩn bị tệp...' : 'Chia Sẻ / Lưu Vào Thư Viện Ảnh'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: HỌC VIỆN SINH TỒN & SƠ CỨU THỰC ĐỊA VIỆT NAM (8 TÌNH HUỐNG) */}
        {/* ================================================================= */}
        {activeTab === 'academy' && (
          <div className="tab-content-slide" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Mastery Progress Header Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                    Học Viện Sinh Tồn & Sơ Cứu Thực Địa Việt Nam (Chuẩn WFA)
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    Luyện tập xử lý 8 tình huống khẩn cấp có thật trên địa hình rừng núi Việt Nam. Tiến độ tự động lưu ngoại tuyến.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    className={`badge ${drillStats.percent >= 75
                      ? 'badge-success'
                      : drillStats.answered > 0
                        ? 'badge-sun'
                        : 'badge-cloud'
                      }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    <IconShieldCheck size={13} />
                    Thành thạo {drillStats.correct}/{drillStats.total} ({drillStats.percent}%)
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '6px 11px', fontSize: '0.78rem' }}
                    onClick={handleResetDrills}
                  >
                    <IconRotateCw size={14} />
                    Làm lại bài tập
                  </button>
                </div>
              </div>

              {/* Mastery Progress Bar */}
              <div
                style={{
                  height: 8,
                  width: '100%',
                  borderRadius: 4,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${drillStats.percent}%`,
                    background: drillStats.percent >= 75 ? 'var(--color-primary)' : 'var(--color-sun)',
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>

              {/* 8 Scenario Selector Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
                {VIETNAM_SURVIVAL_DRILLS.map((sc, idx) => {
                  const chosen = drillAnswers[sc.id];
                  const isDoneCorrect = chosen === sc.correctOptionId;
                  const isDoneWrong = Boolean(chosen) && chosen !== sc.correctOptionId;
                  const isCurrent = idx === activeDrillIdx;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setActiveDrillIdx(idx)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        border: `1px solid ${isCurrent
                          ? 'var(--color-primary)'
                          : isDoneCorrect
                            ? 'var(--color-border-glow)'
                            : isDoneWrong
                              ? 'var(--banner-danger-border)'
                              : 'var(--color-border)'
                          }`,
                        background: isCurrent
                          ? 'color-mix(in srgb, var(--color-primary) 13%, var(--color-bg-card))'
                          : 'var(--color-bg-main)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums' }}>
                        <strong style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-dim)' }}>
                          Tình huống {idx + 1}/8
                        </strong>
                        {isDoneCorrect && <IconCheckCircle size={13} color="var(--color-primary)" />}
                        {isDoneWrong && <IconAlertTriangle size={13} color="var(--color-error)" />}
                      </div>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          color: 'var(--color-text-main)',
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {sc.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Scenario Triage Drill Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className={activeDrill.severity === 'critical' ? 'badge badge-error' : 'badge badge-warning'}>
                      {activeDrill.severity === 'critical' ? 'Nguy Kịch — Ưu Tiên P0' : 'Khẩn Cấp Thực Địa'}
                    </span>
                    <span className="badge badge-info">
                      <IconMapPin size={12} />
                      {activeDrill.location}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {activeDrillIdx + 1}. {activeDrill.title}
                  </h3>
                </div>

                <a
                  href={`tel:${extractPrimaryDialNumber(activeDrill.hotlinePhone)}`}
                  className="btn btn-secondary"
                  style={{ padding: '6px 11px', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums' }}
                >
                  <IconPhone size={14} />
                  {activeDrill.hotlineLabel}: {activeDrill.hotlinePhone}
                </a>
              </div>

              <div
                style={{
                  padding: '13px 15px',
                  borderRadius: 6,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border-strong)',
                  fontSize: '0.92rem',
                  color: 'var(--color-text-main)',
                  lineHeight: 1.6,
                }}
              >
                {activeDrill.situation}
              </div>

              {/* Multiple-Choice Triage Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeDrill.options.map((opt) => {
                  const isSelected = activeSelectedOption === opt.id;
                  const isCorrectOpt = opt.id === activeDrill.correctOptionId;
                  const showReveal = Boolean(activeSelectedOption);

                  let borderColor = 'var(--color-border-strong)';
                  let bg = 'var(--color-bg-main)';
                  if (showReveal && isCorrectOpt) {
                    borderColor = 'var(--color-primary)';
                    bg = 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card))';
                  } else if (showReveal && isSelected && !isCorrectOpt) {
                    borderColor = 'var(--color-error)';
                    bg = 'var(--banner-danger-bg)';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectDrillOption(activeDrill.id, opt.id)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 6,
                        border: `1.5px solid ${borderColor}`,
                        background: bg,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 4,
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          background:
                            showReveal && isCorrectOpt
                              ? 'var(--color-primary)'
                              : showReveal && isSelected
                                ? 'var(--color-error)'
                                : 'var(--color-surface-elevated)',
                          color:
                            showReveal && isCorrectOpt
                              ? 'var(--color-on-primary)'
                              : showReveal && isSelected
                                ? 'var(--color-on-danger)'
                                : 'var(--color-text-main)',
                        }}
                      >
                        {opt.id}
                      </span>
                      <span style={{ fontSize: '0.88rem', lineHeight: 1.5, flex: 1 }}>{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Instant Clinical WFA Explanation + Forbidden Mistake Box */}
              {activeSelectedOption && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 6,
                      background: activeIsCorrect
                        ? 'color-mix(in srgb, var(--color-primary) 11%, var(--color-bg-card))'
                        : 'var(--color-surface-elevated)',
                      border: `1px solid ${activeIsCorrect ? 'var(--color-border-glow)' : 'var(--color-border-strong)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        color: activeIsCorrect ? 'var(--color-primary)' : 'var(--color-earth)',
                      }}
                    >
                      {activeIsCorrect ? <IconCheckCircle size={18} /> : <IconAlertTriangle size={18} />}
                      {activeIsCorrect
                        ? `Chính xác! Đáp án ${activeDrill.correctOptionId} đạt chuẩn Sơ Cứu Hoang Dã (WFA).`
                        : `Chưa an toàn — Đáp án chuẩn WFA là phương án ${activeDrill.correctOptionId}.`}
                    </div>
                    <p style={{ fontSize: '0.86rem', color: 'var(--color-text-main)', lineHeight: 1.6 }}>
                      {activeDrill.clinicalExplanation}
                    </p>
                  </div>

                  {/* Highlighted CẤM KỴ Mistake Box */}
                  <div
                    style={{
                      padding: '12px 15px',
                      borderRadius: 6,
                      background: 'var(--banner-danger-bg)',
                      border: '1px solid var(--banner-danger-border)',
                      color: 'var(--banner-danger-text)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: '0.84rem',
                      lineHeight: 1.55,
                    }}
                  >
                    <IconShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      <strong>{activeDrill.forbiddenMistake}</strong>
                    </span>
                  </div>

                  {/* Verified Vietnam Rescue Quick-Dial Bar */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Đầu mối cứu hộ xác thực khu vực: <strong style={{ color: 'var(--color-text-main)' }}>{activeDrill.hotlineLabel}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href="tel:112" className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '0.76rem' }}>
                        <IconPhoneCall size={13} />
                        Gọi 112
                      </a>
                      <a href="tel:115" className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.76rem' }}>
                        <IconPhone size={13} />
                        Cấp cứu 115
                      </a>
                      {extractPrimaryDialNumber(activeDrill.hotlinePhone) !== '112' && (
                        <a
                          href={`tel:${extractPrimaryDialNumber(activeDrill.hotlinePhone)}`}
                          className="btn btn-primary"
                          style={{ padding: '5px 10px', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums' }}
                        >
                          <IconPhone size={13} />
                          {activeDrill.hotlinePhone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Scenario Step Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={activeDrillIdx === 0}
                  onClick={() => setActiveDrillIdx((i) => Math.max(0, i - 1))}
                >
                  <IconArrowLeft size={15} />
                  Tình huống trước
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  Bài {activeDrillIdx + 1} / {VIETNAM_SURVIVAL_DRILLS.length}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={activeDrillIdx >= VIETNAM_SURVIVAL_DRILLS.length - 1}
                  onClick={() => setActiveDrillIdx((i) => Math.min(VIETNAM_SURVIVAL_DRILLS.length - 1, i + 1))}
                >
                  Tình huống tiếp
                  <IconArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: QUẢN LÝ BỘ NHỚ OFFLINE & GÓI BẢN ĐỒ                        */}
        {/* ================================================================= */}
        {activeTab === 'offline' && (
          <div className="tab-content-slide">
            <OfflineStoragePanel trails={trails} onShowToast={onShowToast} />
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: THỬ TÀI ĐỊA HÌNH & TRẮC DỌC DEM VIỆT NAM                   */}
        {/* ================================================================= */}
        {activeTab === 'quiz' && (
          <div className="tab-content-slide">
            <VietnamPeakQuizPanel
              trails={trails}
              onSelectTrail={handleOpenTrailFromQuiz}
              onShowToast={onShowToast}
            />
          </div>
        )}
      </div>

      {/* Full-Screen Visual SOS Strobe Portal */}
      {strobeActive &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={strobeDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Đèn chớp tín hiệu SOS khẩn cấp"
            tabIndex={-1}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-lightbox, 4000)',
              background: strobeLit ? 'var(--color-on-danger)' : 'var(--color-error)',
              color: strobeLit ? 'var(--color-error)' : 'var(--color-on-danger)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              padding: 24,
              textAlign: 'center',
              transition: 'background-color 45ms linear',
              outline: 'none',
            }}
          >
            <div
              style={{
                fontSize: 'clamp(3.2rem, 12vw, 6.5rem)',
                fontWeight: 800,
                letterSpacing: '0.18em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              S O S
            </div>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, maxWidth: 420 }}>
              Đang phát nhịp Morse Quốc tế (3 ngắn • 3 dài • 3 ngắn). Hướng màn hình về phía đội cứu hộ hoặc trực thăng.
            </p>
            <button
              ref={strobeStopBtnRef}
              type="button"
              className="btn btn-danger"
              onClick={() => setStrobeActive(false)}
              style={{ padding: '14px 28px', fontSize: '1rem', fontWeight: 800 }}
            >
              <IconX size={18} />
              DỪNG ĐÈN SOS (Esc)
            </button>
          </div>,
          document.body
        )}
    </section>
  );
};

export default FieldToolkitView;
