import { mockTrails } from '../data/seedData.js';
import { VIETNAM_RANGER_STATIONS, type RangerStationSeed } from '../data/vietnamDirectory.js';
import { normalizeSearchText } from '../data/trekkerKnowledgeDataset.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { computeTrailGoNoGo, getVietnamTodayIso, isValidCalendarDateIso } from './goNoGo.service.js';
import { calculateAlpineBioMetrics } from './aiBioCalculator.service.js';
import {
  extractPrimaryDialNumber,
  type AiFitnessLevel,
  type ExpeditionBriefBudgetLine,
  type ExpeditionBriefGearItem,
  type ExpeditionBriefInput,
  type ExpeditionBriefRangerInfo,
  type ExpeditionBriefResult,
  type GoNoGoAssessmentPayload,
  type StructuredItineraryStep,
} from './ai.types.js';
import type { Trail, Waypoint } from '../types.js';

function roundTo10k(vnd: number): number {
  return Math.max(0, Math.round(vnd / 10_000) * 10_000);
}

function resolveVerifiedRangerStation(trail: Trail): ExpeditionBriefRangerInfo {
  // 1. Exact canonical trail slug match
  const exact: RangerStationSeed | undefined = VIETNAM_RANGER_STATIONS.find((s) =>
    s.coveredTrailSlugs.includes(trail.id)
  );
  if (exact) {
    return {
      name: exact.name,
      authorityType: exact.authorityType,
      province: exact.province,
      address: exact.address,
      hotlinePhone: exact.hotlinePhone,
      emergencyPhone: exact.emergencyPhone,
      dialNumber: extractPrimaryDialNumber(exact.hotlinePhone || exact.emergencyPhone),
      permitRequired: exact.permitRequired || trail.permitRequired,
      permitLeadDays: exact.permitLeadDays,
      permitFeeNote: exact.permitFeeNote || trail.permitInfo || 'Mang theo CCCD bản gốc khai báo tại chốt cửa rừng.',
      officeHours: exact.officeHours,
      officialWebsite: exact.officialWebsite,
    };
  }

  // 2. Normalized province match among parks & forestry stations
  const trailProvNorm = normalizeSearchText(trail.province);
  const trailNameNorm = normalizeSearchText(trail.name);
  const byProvince = VIETNAM_RANGER_STATIONS.find((s) => {
    if (s.authorityType === 'rescue_center' && s.province === 'Toàn Quốc') return false;
    const sProv = normalizeSearchText(s.province);
    const sName = normalizeSearchText(s.name);
    return (
      (sProv.length >= 4 && (trailProvNorm.includes(sProv) || sProv.includes(trailProvNorm))) ||
      (trailNameNorm.includes('ba vi') && sName.includes('ba vi')) ||
      (trailNameNorm.includes('bu gia map') && sName.includes('bu gia map')) ||
      (trailNameNorm.includes('langbiang') && sName.includes('bidoup'))
    );
  });

  if (byProvince) {
    return {
      name: byProvince.name,
      authorityType: byProvince.authorityType,
      province: byProvince.province,
      address: byProvince.address,
      hotlinePhone: byProvince.hotlinePhone,
      emergencyPhone: byProvince.emergencyPhone,
      dialNumber: extractPrimaryDialNumber(byProvince.hotlinePhone || byProvince.emergencyPhone),
      permitRequired: byProvince.permitRequired || trail.permitRequired,
      permitLeadDays: byProvince.permitLeadDays,
      permitFeeNote:
        trail.permitInfo || byProvince.permitFeeNote || 'Mang theo CCCD bản gốc khai báo kiểm lâm cửa rừng.',
      officeHours: byProvince.officeHours,
      officialWebsite: byProvince.officialWebsite,
    };
  }

  // 3. Fallback to trail's own verified rescueContact + National 112
  const phoneDisplay = trail.rescueContact?.phone || '112';
  return {
    name: trail.rescueContact?.name || `Ban Quản lý / Kiểm lâm khu vực ${trail.province}`,
    authorityType: trail.permitRequired ? 'ranger_station' : 'rescue_center',
    province: trail.province,
    address: `${trail.district}, ${trail.province}`,
    hotlinePhone: phoneDisplay,
    emergencyPhone: '112 / 114',
    dialNumber: extractPrimaryDialNumber(phoneDisplay),
    permitRequired: trail.permitRequired,
    permitLeadDays: trail.permitRequired ? 1 : 0,
    permitFeeNote:
      trail.permitInfo ||
      'Khai báo danh sách thành viên, mang CCCD bản gốc và lưu sẵn tổng đài cứu nạn quốc gia 112 / 114.',
    officeHours: '07:00 - 17:30 (Cứu nạn 112/114 trực 24/7)',
  };
}

function buildWaypointSnippet(waypoints: Waypoint[], types: Waypoint['type'][]): string | undefined {
  const match = waypoints.find((w) => types.includes(w.type));
  if (!match) return undefined;
  return match.elevationM ? `${match.name} (~${match.elevationM.toLocaleString()}m)` : match.name;
}

function buildExpeditionItinerary(
  trail: Trail,
  movingHours: number,
  ranger: ExpeditionBriefRangerInfo
): StructuredItineraryStep[] {
  const days = Math.max(1, Math.min(5, Math.round(trail.durationDays || 1)));
  const waypoints = Array.isArray(trail.waypoints) ? trail.waypoints : [];
  const campWp = buildWaypointSnippet(waypoints, ['campsite']);
  const waterWp = buildWaypointSnippet(waypoints, ['water', 'rest']);
  const summitWp = buildWaypointSnippet(waypoints, ['viewpoint']) || `Đỉnh ${trail.name} (${trail.maxAltitudeM.toLocaleString()}m)`;
  const dangerWp = buildWaypointSnippet(waypoints, ['danger']);
  const startLoc = `${trail.district}, ${trail.province}`;

  if (days <= 1) {
    const estClimbH = Math.max(1.5, Math.round(movingHours * 0.58 * 10) / 10);
    return [
      {
        day: 1,
        time: '05:30',
        title: 'Tập kết cửa rừng & kiểm tra trang bị',
        description: trail.permitRequired
          ? `Xuất trình CCCD và hoàn tất khai báo tuyến với ${ranger.name}. Khởi động giãn cơ cổ chân, khớp gối và đồng bộ bản đồ Offline LOST.`
          : `Kiểm tra lại lượng nước uống, đèn pin dự phòng, điện giải và bật chế độ theo dõi GPX Offline LOST.`,
        locationNote: startLoc,
      },
      {
        day: 1,
        time: '06:30',
        title: `Khởi hành chặng leo lên (~${estClimbH}h)`,
        description: waterWp
          ? `Duy trì nhịp bước đều, hít thở sâu. Điểm dừng tiếp nước / nghỉ chân dự kiến tại ${waterWp}.`
          : `Duy trì nhịp bước đều (Rest Step ở các dốc > 15%), nhấp nước mỗi 15–20 phút để tránh chuột rút.`,
        locationNote: waterWp || `Cửa rừng ${trail.name}`,
      },
      {
        day: 1,
        time: '11:00',
        title: `Chinh phục ${summitWp}`,
        description: `Nghỉ ăn trưa nạp năng lượng nhanh, kiểm tra nhiệt độ và hướng gió. Giờ quay đầu an toàn (Turn-around Time) chậm nhất là 13:00.`,
        locationNote: summitWp,
      },
      {
        day: 1,
        time: '12:30',
        title: 'Hạ sơn & kiểm soát tốc độ đổ dốc',
        description: dangerWp
          ? `Dùng gậy trekking giảm tải khớp gối; đặc biệt thận trọng đoạn ${dangerWp}. Đảm bảo xuống khỏi rừng trước 16:30.`
          : `Giữ trọng tâm thấp, dùng gậy trekking bảo vệ khớp gối. Hoàn tất toàn tuyến trước 16:30 trước khi trời tối.`,
        locationNote: `Về điểm xuất phát (${startLoc})`,
      },
    ];
  }

  if (days === 2) {
    return [
      {
        day: 1,
        time: '06:30',
        title: 'Tập kết & khai báo cửa rừng',
        description: `Kiểm tra giấy tờ CCCD, chia tải trọng đồ chung và phổ biến quy tắc an toàn nhóm với HDV / ${ranger.name}.`,
        locationNote: startLoc,
      },
      {
        day: 1,
        time: '07:30',
        title: 'Xuất phát ngày 1 — Vượt chặng tiếp cận',
        description: waterWp
          ? `Di chuyển theo đội hình thống nhất (không tách lẻ). Nghỉ ăn trưa và lọc nước bổ sung tại khu vực ${waterWp}.`
          : `Di chuyển tốc độ ổn định để bảo toàn sức cho ngày chinh phục đỉnh; uống đều điện giải Oresol dọc tuyến.`,
        locationNote: waterWp || `Tuyến tiếp cận ${trail.name}`,
      },
      {
        day: 1,
        time: '15:30',
        title: `Hạ trại / nhận lán nghỉ đêm`,
        description: `Tới ${campWp || 'lán nghỉ / bãi trại chính'} trước 16:30 để dựng trại khi còn sáng. Thay ngay đồ khô giữ ấm, ăn tối nóng và ngủ sớm lúc 20:30.`,
        locationNote: campWp || `Lán nghỉ đêm ${trail.name}`,
      },
      {
        day: 2,
        time: '04:30',
        title: `Chinh phục ${summitWp} đón bình minh`,
        description: `Chỉ mang balo phụ gọn nhẹ (nước ấm, áo gió, đèn pin đội đầu, lương khô). Chạm đỉnh săn mây / check-in mốc cao độ ${trail.maxAltitudeM.toLocaleString()}m.`,
        locationNote: summitWp,
      },
      {
        day: 2,
        time: '08:00',
        title: 'Thu dọn trại (Leave No Trace) & hạ sơn',
        description: dangerWp
          ? `Thu gom 100% rác thải mang ra khỏi rừng. Bắt đầu đổ dốc lúc 09:00, tập trung tối đa qua đoạn ${dangerWp}.`
          : `Thu gom 100% rác mang khỏi rừng. Bắt đầu hạ sơn lúc 09:00, dùng gậy trekking bảo vệ đầu gối.`,
        locationNote: campWp || `Trục hạ sơn ${trail.name}`,
      },
      {
        day: 2,
        time: '15:30',
        title: 'Hoàn thành cung đường & xác nhận an toàn',
        description: `Điểm danh đủ thành viên tại cửa rừng, báo hoàn tất với chốt kiểm lâm / điểm gửi xe và giãn cơ phục hồi.`,
        locationNote: startLoc,
      },
    ];
  }

  // 3N2Đ or longer expedition
  return [
    {
      day: 1,
      time: '06:30',
      title: 'Khai báo thủ tục & xuất phát chặng 1',
      description: `Hoàn tất thủ tục với ${ranger.name}. Phân công người dẫn đầu (Lead) và khóa đuôi (Sweep), kiểm tra bộ đàm / GPX Offline.`,
      locationNote: startLoc,
    },
    {
      day: 1,
      time: '16:00',
      title: 'Hạ trại đêm 1 & thích nghi độ cao',
      description: `Đến ${campWp || 'điểm trại / lán nghỉ số 1'} trước khi trời tối. Uống trà gừng ấm, không uống rượu bia để tránh sốc độ cao AMS.`,
      locationNote: campWp || `Lán nghỉ đêm 1`,
    },
    {
      day: 2,
      time: '05:00',
      title: `Ngày đỉnh cao nhất — Chinh phục ${summitWp}`,
      description: dangerWp
        ? `Xuất phát sớm tối ưu thời gian leo đỉnh ${trail.maxAltitudeM.toLocaleString()}m. Thận trọng địa hình dốc tại ${dangerWp}, giữ giờ quay đầu chậm nhất 13:00.`
        : `Xuất phát sớm chinh phục đỉnh ${trail.maxAltitudeM.toLocaleString()}m. Duy trì nhịp Rest Step và đảm bảo rời đỉnh trước 13:00 để về trại an toàn.`,
      locationNote: summitWp,
    },
    {
      day: 2,
      time: '16:30',
      title: 'Nghỉ đêm 2 & phục hồi thể lực',
      description: `Bổ sung tinh bột + đạm ấm, kiểm tra phồng rộp bàn chân, phơi tất/giày gần bếp lán và sạc đầy đèn pin cho ngày cuối.`,
      locationNote: campWp || `Lán nghỉ đêm 2`,
    },
    {
      day: 3,
      time: '07:30',
      title: 'Thu trại Leave No Trace & hành trình hạ sơn',
      description: `Kiểm tra sạch khu vực trại, thu gom toàn bộ rác thải. Đổ dốc nhịp ổn định và bổ sung điện giải suốt chặng về.`,
      locationNote: waterWp || `Tuyến hạ sơn ${trail.name}`,
    },
    {
      day: 3,
      time: '15:30',
      title: 'Cập bến cửa rừng & kết thúc hành trình',
      description: `Xác nhận đủ quân số, trả thủ tục (nếu có) với kiểm lâm / biên phòng địa phương và di chuyển về điểm nghỉ ngơi.`,
      locationNote: startLoc,
    },
  ];
}

function buildSurvivalChecklist(
  trail: Trail,
  goNoGo: GoNoGoAssessmentPayload | null,
  waterLitersPerDay: number,
  oresolPackets: number
): ExpeditionBriefGearItem[] {
  const summitTempMin =
    goNoGo?.factors?.summitTempMinC ??
    goNoGo?.weatherSummary?.summitTempMinC ??
    goNoGo?.weatherSummary?.tempMinC ??
    (trail.maxAltitudeM >= 2500 ? 6 : trail.maxAltitudeM >= 1500 ? 14 : 22);
  const precipMm = goNoGo?.weatherSummary?.precipMm ?? 0;

  const items: ExpeditionBriefGearItem[] = [
    {
      name: 'Giày trekking đế gai sâu (đã đi quen chân)',
      category: 'Trang phục',
      weightGrams: 920,
      isEssential: true,
      reason: 'Chống trượt bùn đá và bảo vệ cổ chân trên địa hình đồi núi.',
    },
    {
      name: trail.durationDays >= 2 ? 'Balo trợ lực 35–45L + áo trùm mưa balo' : 'Balo trợ lực 20–28L + áo trùm mưa',
      category: 'Khác',
      weightGrams: trail.durationDays >= 2 ? 1350 : 850,
      isEssential: true,
      reason: 'Phân bổ tải trọng vào đai hông và bảo vệ đồ khô tuyệt đối.',
    },
    {
      name: `Bình / túi nước mềm đủ ${Math.max(2, Math.ceil(waterLitersPerDay))}L mỗi ngày`,
      category: 'Ăn uống & Nước',
      weightGrams: 280,
      isEssential: true,
      reason: trail.hasWaterSource
        ? `Nhu cầu sinh học ước tính ${waterLitersPerDay}L/ngày (có suối để lọc tiếp nước).`
        : `Tuyến KHÔNG có nguồn nước tự nhiên ổn định — bắt buộc mang đủ nước từ chân núi.`,
    },
    {
      name: `Đèn pin đội đầu (Headlamp >= 300lm) + pin dự phòng`,
      category: 'Điện tử',
      weightGrams: 180,
      isEssential: true,
      reason: 'Thiết yếu khi leo đón bình minh hoặc tình huống về muộn lúc trời sập tối.',
    },
    {
      name: 'Áo mưa bộ 2 lớp chống thấm (không dùng áo mưa cánh dơi)',
      category: 'Trang phục',
      weightGrams: 440,
      isEssential: true,
      reason: precipMm >= 5
        ? `Dự báo có mưa (${precipMm} mm) — cần chắn mưa gió và ngăn hạ thân nhiệt.`
        : 'Thời tiết núi biến đổi nhanh, áo mưa bộ giúp chắn gió rét và mưa rừng đột ngột.',
    },
    {
      name: `Túi sơ cứu WFA + ${oresolPackets} gói Oresol + băng ép cổ chân`,
      category: 'Y tế & An toàn',
      weightGrams: 260,
      isEssential: true,
      reason: 'Xử lý phồng rộp, bong gân, chuột rút điện giải và vết cắt rừng.',
    },
    {
      name: 'Còi sinh tồn tần số cao + chăn giữ nhiệt bạc (Space Blanket)',
      category: 'Y tế & An toàn',
      weightGrams: 110,
      isEssential: true,
      reason: 'Bắt buộc cho quy tắc sinh tồn S.T.O.P khi tách đoàn hoặc chờ cứu hộ.',
    },
    {
      name: 'Pin sạc dự phòng 20.000mAh + cáp sạc (đã tải GPX Offline LOST)',
      category: 'Điện tử',
      weightGrams: 420,
      isEssential: true,
      reason: 'Pin điện thoại tụt nhanh gấp đôi trong rừng không sóng và trời lạnh.',
    },
  ];

  if (trail.maxAltitudeM >= 2200 || summitTempMin <= 10) {
    items.push({
      name: summitTempMin <= 4 ? 'Áo lông vũ dày (-5°C) + áo giữ nhiệt + găng/mũ len' : 'Áo khoác gió/lông vũ nhẹ + áo giữ nhiệt thermal',
      category: 'Trang phục',
      weightGrams: summitTempMin <= 4 ? 620 : 420,
      isEssential: true,
      reason: `Nhiệt độ đỉnh ${trail.maxAltitudeM.toLocaleString()}m về đêm ước tính ~${summitTempMin}°C.`,
    });
  }

  if (trail.durationDays >= 2) {
    items.push({
      name: summitTempMin <= 6 ? 'Túi ngủ chịu nhiệt 0°C – 5°C + tấm cách nhiệt' : 'Túi ngủ chịu nhiệt 8°C – 12°C + bộ đồ khô ngủ đêm',
      category: 'Đồ ngủ & Lán',
      weightGrams: summitTempMin <= 6 ? 1350 : 950,
      isEssential: true,
      reason: 'Giữ thân nhiệt ổn định khi nghỉ đêm trên lán gỗ hoặc bãi trại.',
    });
  }

  if (trail.hasWaterSource) {
    items.push({
      name: 'Ống lọc nước dã ngoại (Sawyer / Katadyn) hoặc viên khử khuẩn',
      category: 'Ăn uống & Nước',
      weightGrams: 110,
      isEssential: trail.durationDays >= 2,
      reason: 'Lọc trực tiếp nước suối sạch an toàn, giảm trọng lượng nước phải mang.',
    });
  } else {
    items.push({
      name: 'Túi nước dự trữ bổ sung (+1.5L) & viên sủi điện giải',
      category: 'Ăn uống & Nước',
      weightGrams: 140,
      isEssential: true,
      reason: 'Tuyến khô thiếu suối — bắt buộc dự phòng nước chống sốc nhiệt.',
    });
  }

  if (trail.permitRequired) {
    items.push({
      name: 'CCCD bản gốc + bản sao giấy phép VQG / Biên phòng (bọc túi zip)',
      category: 'Khác',
      weightGrams: 30,
      isEssential: true,
      reason: trail.permitInfo || 'Bắt buộc xuất trình tại trạm kiểm lâm / cửa rừng.',
    });
  }

  if (trail.difficultyLevel >= 4 || trail.elevationGainM >= 1100) {
    items.push({
      name: 'Cặp gậy trekking hợp kim nhôm + băng bó gối thể thao',
      category: 'Trang phục',
      weightGrams: 520,
      isEssential: false,
      reason: `Giảm 20–25% áp lực lên khớp gối khi vượt độ cao tích lũy +${trail.elevationGainM.toLocaleString()}m.`,
    });
  }

  if (precipMm >= 8 || trail.region === 'Miền Bắc' || trail.region === 'Miền Trung') {
    items.push({
      name: 'Xà cạp chống vắt / bùn (Gaiters) + túi khô Dry Bag 15L',
      category: 'Trang phục',
      weightGrams: 240,
      isEssential: precipMm >= 12,
      reason: 'Ngăn vắt rừng, sỏi đá rơi vào giày và giữ khô hoàn toàn quần áo ngủ.',
    });
  }

  return items;
}

function buildRealisticVietnamBudget(
  trail: Trail,
  groupSize: number
): ExpeditionBriefResult['budget'] {
  const days = Math.max(1, Math.min(7, Math.round(trail.durationDays || 1)));
  const nights = Math.max(0, days - 1);

  // 1. Vé VQG / Giấy phép / Phí môi trường rừng
  let permitPerPerson = 0;
  let permitDetail = 'Cung mở / tự do (không thu phí cổng bắt buộc)';
  if (trail.permitRequired) {
    if (trail.maxAltitudeM >= 2900) {
      permitPerPerson = 250_000;
      permitDetail = 'Vé VQG, phí bảo vệ rừng & thủ tục đăng ký tuyến núi cao (>2.900m)';
    } else if (trail.id === 'trail-cattien-bausau') {
      permitPerPerson = 310_000;
      permitDetail = 'Vé cổng VQG (60k) + vé khu Ramsar Bàu Sấu (250k)';
    } else {
      permitPerPerson = 120_000;
      permitDetail = 'Vé tham quan VQG / phí môi trường rừng & khai báo kiểm lâm';
    }
  }

  // 2. Hướng dẫn viên bản địa / Kiểm lâm dẫn đường (chia đều theo nhóm)
  const needsGuide = trail.permitRequired || trail.difficultyLevel >= 3 || days >= 2;
  const guideCount = needsGuide ? Math.max(1, Math.ceil(groupSize / 6)) : 0;
  const guideDailyRate = trail.maxAltitudeM >= 2800 ? 700_000 : 550_000;
  const guideGroupTotal = guideCount * guideDailyRate * days;
  const guidePerPerson = needsGuide ? roundTo10k(guideGroupTotal / groupSize) : 0;

  // 3. Porter hậu cần gùi đồ chung & nấu ăn (tuyến >= 2 ngày hoặc cấp >= 4)
  const needsPorter = days >= 2 || trail.difficultyLevel >= 4;
  const porterCount = needsPorter ? Math.max(1, Math.ceil(groupSize / 4)) : 0;
  const porterDailyRate = 550_000;
  const porterGroupTotal = porterCount * porterDailyRate * days;
  const porterPerPerson = needsPorter ? roundTo10k(porterGroupTotal / groupSize) : 0;

  // 4. Ăn uống, lương khô, nước & điện giải
  const foodPerPerson = roundTo10k(days <= 1 ? 160_000 : 180_000 + (days - 1) * 240_000);

  // 5. Lán nghỉ đêm / thuê lều + túi ngủ
  const shelterPerPerson = nights > 0 ? roundTo10k(nights * 220_000) : 0;

  // 6. Xe trung chuyển địa phương / xe ôm cửa rừng & gửi xe
  const transportPerPerson = roundTo10k(
    trail.maxAltitudeM >= 2500 ? 250_000 : days >= 2 ? 200_000 : 120_000
  );

  const lines: ExpeditionBriefBudgetLine[] = [
    {
      key: 'permit',
      label: 'Vé VQG & Thủ tục rừng',
      detail: permitDetail,
      perPersonVnd: permitPerPerson,
      groupTotalVnd: permitPerPerson * groupSize,
    },
    {
      key: 'guide',
      label: 'HDV bản địa / Kiểm lâm',
      detail: needsGuide
        ? `${guideCount} HDV × ${(guideDailyRate / 1000).toLocaleString()}k/ngày × ${days} ngày (chia ${groupSize} người)`
        : 'Tuyến ngắn dễ định vị — có thể tự túc theo GPX Offline',
      perPersonVnd: guidePerPerson,
      groupTotalVnd: guidePerPerson * groupSize,
    },
    {
      key: 'porter',
      label: 'Porter hậu cần / nấu ăn',
      detail: needsPorter
        ? `${porterCount} Porter × ${(porterDailyRate / 1000).toLocaleString()}k/ngày × ${days} ngày (chia ${groupSize} người)`
        : 'Chuyến đi trong ngày — tự túc balo gọn nhẹ',
      perPersonVnd: porterPerPerson,
      groupTotalVnd: porterPerPerson * groupSize,
    },
    {
      key: 'food',
      label: 'Ăn uống, nước & Oresol',
      detail: days <= 1 ? 'Bữa trưa dã ngoại, nước suối, lương khô & điện giải' : `Các bữa chính trên lán/trại + lương khô & điện giải ${days} ngày`,
      perPersonVnd: foodPerPerson,
      groupTotalVnd: foodPerPerson * groupSize,
    },
    {
      key: 'shelter',
      label: 'Lán gỗ / thuê lều túi ngủ',
      detail: nights > 0 ? `${nights} đêm ngủ lán hoặc thuê bộ lều + túi ngủ ấm` : 'Không phát sinh lưu trú qua đêm trong rừng',
      perPersonVnd: shelterPerPerson,
      groupTotalVnd: shelterPerPerson * groupSize,
    },
    {
      key: 'transport',
      label: 'Trung chuyển cửa rừng & gửi xe',
      detail: 'Xe ôm trung chuyển vào điểm xuất phát, gửi xe, tắm nóng sau chuyến',
      perPersonVnd: transportPerPerson,
      groupTotalVnd: transportPerPerson * groupSize,
    },
  ];

  const perPersonVnd = lines.reduce((sum, l) => sum + l.perPersonVnd, 0);
  const groupTotalVnd = lines.reduce((sum, l) => sum + l.groupTotalVnd, 0);
  const contingencyPerPersonVnd = roundTo10k(perPersonVnd * 0.15);
  const grandTotalPerPersonVnd = perPersonVnd + contingencyPerPersonVnd;
  const grandTotalGroupVnd = grandTotalPerPersonVnd * groupSize;

  return {
    currency: 'VND',
    groupSize,
    days,
    lines,
    perPersonVnd,
    groupTotalVnd,
    contingencyPerPersonVnd,
    grandTotalPerPersonVnd,
    grandTotalGroupVnd,
    note: `Ước tính thực địa tại cửa rừng cho nhóm ${groupSize} người (chưa bao gồm vé máy bay / xe khách giường nằm liên tỉnh tới ${trail.province}).`,
  };
}

function buildSafetyNotes(
  trail: Trail,
  goNoGo: GoNoGoAssessmentPayload | null,
  ranger: ExpeditionBriefRangerInfo,
  amsRiskLevel: string
): string[] {
  const notes: string[] = [];

  if (goNoGo) {
    if (goNoGo.verdict === 'NO_GO') {
      notes.push(`CẢNH BÁO GO/NO-GO (${goNoGo.score}/100): ${goNoGo.verdictLabel} — ${goNoGo.advice}`);
    } else if (goNoGo.verdict === 'CAUTION') {
      notes.push(`LƯU Ý THỜI TIẾT & THỰC ĐỊA (${goNoGo.score}/100): ${goNoGo.advice}`);
    }
    if (goNoGo.activeIncidentsCount > 0) {
      notes.push(`Đang ghi nhận ${goNoGo.activeIncidentsCount} cảnh báo sự cố thực địa mở trên tuyến — kiểm tra mục Sự cố trước khi xuất phát.`);
    }
  }

  if (amsRiskLevel === 'high' || amsRiskLevel === 'moderate') {
    notes.push(`Đỉnh ${trail.maxAltitudeM.toLocaleString()}m có nguy cơ sốc độ cao (AMS) & hạ thân nhiệt đêm. Đi nhịp chậm Rest Step, tránh rượu bia và hạ ngay 300–500m nếu đau đầu buốt hoặc buồn nôn.`);
  }

  if (!trail.hasWaterSource) {
    notes.push('Cung đường thiếu nguồn nước tự nhiên dọc tuyến — kiểm soát định mức nước uống chặt chẽ và không rút ngắn dự phòng.');
  }

  if (ranger.permitRequired && ranger.permitLeadDays > 0) {
    notes.push(`Thủ tục giấy phép: Liên hệ ${ranger.name} (${ranger.hotlinePhone}) trước ít nhất ${ranger.permitLeadDays} ngày để đăng ký danh sách đoàn.`);
  }

  notes.push(`Khẩn cấp trong rừng: Giữ nguyên vị trí theo quy tắc S.T.O.P, gửi tọa độ GPS qua SMS 2G và gọi ${ranger.hotlinePhone} hoặc Tổng đài cứu nạn quốc gia 112 / 114 / 115.`);
  notes.push('Nguyên tắc Leave No Trace: Mang toàn bộ rác thải (kể cả vỏ kẹo, giấy ướt) ra khỏi rừng và tuyệt đối không đốt lửa ngoài khu vực kiểm lâm cho phép.');

  return notes.slice(0, 6);
}

/**
 * Generates a full Pre-Trip Expedition Dossier combining Live Go/No-Go, Naismith/Tobler Bio-Metrics,
 * Verified Ranger/VQG station, Day-by-Day Hour-by-Hour Itinerary, Survival Checklist & VND Budget.
 */
export async function generateExpeditionBrief(
  input: ExpeditionBriefInput,
  availableTrails: Trail[] = []
): Promise<ExpeditionBriefResult | null> {
  const pool = availableTrails.length > 0 ? availableTrails : mockTrails;
  const rawId = (input.trailId || '').trim();
  if (!rawId) return null;

  let rawTrail: any =
    pool.find((t) => t.id === rawId) ||
    pool.find((t) => normalizeSearchText(t.name) === normalizeSearchText(rawId)) ||
    null;

  if (!rawTrail) {
    rawTrail = (await resolveTrailByIdOrSlug(rawId).catch(() => null)) || null;
  }
  if (!rawTrail) return null;

  // Normalize legacy DB trails safely so missing slug/numeric fields never throw 500
  const trail: Trail = {
    ...(rawTrail as Trail),
    id: String(rawTrail.id || rawTrail._id || rawId),
    name: String(rawTrail.name || 'Cung đường LOST'),
    province: String(rawTrail.province || 'Việt Nam'),
    district: String(rawTrail.district || ''),
    region: (rawTrail.region === 'Miền Trung' || rawTrail.region === 'Miền Nam' ? rawTrail.region : 'Miền Bắc'),
    startLat: Number.isFinite(Number(rawTrail.startLat)) ? Number(rawTrail.startLat) : 22.3364,
    startLng: Number.isFinite(Number(rawTrail.startLng)) ? Number(rawTrail.startLng) : 103.8438,
    endLat: Number.isFinite(Number(rawTrail.endLat)) ? Number(rawTrail.endLat) : Number(rawTrail.startLat) || 22.3032,
    endLng: Number.isFinite(Number(rawTrail.endLng)) ? Number(rawTrail.endLng) : Number(rawTrail.startLng) || 103.7753,
    maxAltitudeM: Number.isFinite(Number(rawTrail.maxAltitudeM)) ? Number(rawTrail.maxAltitudeM) : 1500,
    distanceKm: Number.isFinite(Number(rawTrail.distanceKm)) ? Number(rawTrail.distanceKm) : 12,
    elevationGainM: Number.isFinite(Number(rawTrail.elevationGainM)) ? Number(rawTrail.elevationGainM) : 600,
    durationDays: Number.isFinite(Number(rawTrail.durationDays)) && Number(rawTrail.durationDays) >= 1 ? Number(rawTrail.durationDays) : 1,
    durationHoursNote: String(rawTrail.durationHoursNote || `${Number(rawTrail.durationDays) || 1} ngày`),
    difficultyLevel: Number.isFinite(Number(rawTrail.difficultyLevel)) ? Number(rawTrail.difficultyLevel) : 3,
    difficultyNote: String(rawTrail.difficultyNote || 'Tiêu chuẩn'),
    permitRequired: Boolean(rawTrail.permitRequired),
    permitInfo: typeof rawTrail.permitInfo === 'string' ? rawTrail.permitInfo : '',
    hasWaterSource: rawTrail.hasWaterSource !== false,
    hasCampsite: Boolean(rawTrail.hasCampsite),
    bestMonths: Array.isArray(rawTrail.bestMonths) ? rawTrail.bestMonths : [],
    avoidMonths: Array.isArray(rawTrail.avoidMonths) ? rawTrail.avoidMonths : [],
    transportationInfo: String(rawTrail.transportationInfo || ''),
    waypoints: Array.isArray(rawTrail.waypoints) ? rawTrail.waypoints : [],
  };

  const departureDate =
    input.departureDate && isValidCalendarDateIso(input.departureDate)
      ? input.departureDate
      : getVietnamTodayIso();
  const groupSize = Math.max(1, Math.min(12, Math.round(Number(input.groupSize) || 4)));
  const fitnessLevel: AiFitnessLevel =
    input.fitnessLevel === 'beginner' || input.fitnessLevel === 'advanced'
      ? input.fitnessLevel
      : 'intermediate';
  const bodyWeightKg = Math.max(35, Math.min(160, Math.round(Number(input.bodyWeightKg) || 62)));
  const defaultPack = trail.durationDays >= 2 ? 9 : 4.5;
  const hasExplicitPack =
    input.packWeightKg !== undefined &&
    input.packWeightKg !== null &&
    String(input.packWeightKg).trim() !== '' &&
    Number.isFinite(Number(input.packWeightKg));
  const packWeightKg = Math.max(0, Math.min(40, hasExplicitPack ? Number(input.packWeightKg) : defaultPack));

  const goNoGo = await computeTrailGoNoGo(trail.id, departureDate).catch(() => null);

  const ambientTempC =
    goNoGo?.weatherSummary?.tempMaxC !== undefined && Number.isFinite(goNoGo.weatherSummary.tempMaxC)
      ? goNoGo.weatherSummary.tempMaxC
      : undefined;

  const bioMetrics = calculateAlpineBioMetrics({
    trailId: trail.id,
    trailName: trail.name,
    distanceKm: trail.distanceKm,
    elevationGainM: trail.elevationGainM,
    elevationLossM: trail.elevationGainM,
    maxAltitudeM: trail.maxAltitudeM,
    bodyWeightKg,
    packWeightKg,
    fitnessLevel,
    ambientTempC,
    durationDays: trail.durationDays,
  });

  const rangerStation = resolveVerifiedRangerStation(trail);
  const itinerarySteps = buildExpeditionItinerary(trail, bioMetrics.recommendedMovingHours, rangerStation);
  const survivalChecklist = buildSurvivalChecklist(
    trail,
    goNoGo,
    bioMetrics.waterLitersPerDay,
    bioMetrics.oresolPackets
  );
  const totalChecklistGrams = survivalChecklist.reduce((sum, item) => sum + item.weightGrams, 0);
  const budget = buildRealisticVietnamBudget(trail, groupSize);
  const safetyNotes = buildSafetyNotes(trail, goNoGo, rangerStation, bioMetrics.amsRiskLevel);

  return {
    generatedAt: new Date().toISOString(),
    departureDate,
    groupSize,
    fitnessLevel,
    trail: {
      id: trail.id,
      name: trail.name,
      province: trail.province,
      district: trail.district,
      region: trail.region,
      maxAltitudeM: trail.maxAltitudeM,
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      durationDays: trail.durationDays,
      durationHoursNote: trail.durationHoursNote,
      difficultyLevel: trail.difficultyLevel,
      difficultyNote: trail.difficultyNote,
      permitRequired: trail.permitRequired,
      permitInfo: trail.permitInfo,
      hasWaterSource: trail.hasWaterSource,
      hasCampsite: trail.hasCampsite,
      bestMonths: trail.bestMonths,
      avoidMonths: trail.avoidMonths,
      transportationInfo: trail.transportationInfo,
      startLat: trail.startLat,
      startLng: trail.startLng,
    },
    goNoGo,
    bioMetrics,
    rangerStation,
    itinerarySteps,
    survivalChecklist,
    totalChecklistGrams,
    budget,
    safetyNotes,
  };
}
