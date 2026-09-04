import { describe, it, expect } from 'vitest';
import { queryKnowledgeDataset } from '../data/trekkerKnowledgeDataset.js';
import { removeEmojis } from '../services/ai.service.js';

describe('TrekCopilot AI - Comprehensive Edge Cases & Extreme Survival Test Suite (26 Scenarios)', () => {
  // SCENARIO 1: Sole Delamination (Bung đế giày)
  it('Scenario 1: Handles broken boot sole mid-hike with emergency field repairs', () => {
    const results = queryKnowledgeDataset('bung đế giày giữa đường thì sửa thế nào');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Băng dính bạc (Duct Tape)');
    expect(top.answer).toContain('Dây rút nhựa');
    expect(top.answer).toContain('Paracord');
    expect(removeEmojis(top.answer)).toBe(top.answer);
  });

  // SCENARIO 2: Lightning Threat on Ridge (Giông sét sống núi)
  it('Scenario 2: Handles sudden thunderstorm & lightning strike risks on open ridges', () => {
    const results = queryKnowledgeDataset('gặp dông sét trên đỉnh núi trống');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Lightning Squat');
    expect(top.answer).toContain('gậy leo núi kim loại');
    expect(top.answer).toContain('Cấm nằm áp bụng xuống đất');
  });

  // SCENARIO 3: Venomous Snake Bite (Rắn độc cắn)
  it('Scenario 3: Provides strict WFA protocols for venomous snake bites (No tourniquet/incision)', () => {
    const results = queryKnowledgeDataset('bị rắn lục đuôi đỏ cắn vào chân');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Bất động');
    expect(top.answer).toContain('Băng ép thun đàn hồi');
    expect(top.answer).toContain('CẤM rạch');
    expect(top.answer).toContain('CẤM garo');
  });

  // SCENARIO 4: Wasp / Hornet Swarm Attack (Bầy ong vò vẽ tấn công)
  it('Scenario 4: Handles hornet & wasp swarm attacks safely', () => {
    const results = queryKnowledgeDataset('bị bầy ong vò vẽ đuổi đốt');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Bảo vệ phần đầu và mặt');
    expect(top.answer).toContain('xuôi chiều gió');
    expect(top.answer).toContain('KHÔNG nhảy xuống hồ suối sâu');
  });

  // SCENARIO 5: Ripped Tent in Gale (Rách lều / gãy cọc trong bão đêm)
  it('Scenario 5: Handles tent ripped by gale and broken tent poles at night', () => {
    const results = queryKnowledgeDataset('lều bị gió bão giật rách toạc gãy cọc lều');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Bivy khẩn cấp');
    expect(top.answer).toContain('Poncho/Áo mưa cánh dơi');
    expect(top.answer).toContain('Cách ly nhiệt');
  });

  // SCENARIO 6: Lost Fire / Wet Lighter (Mất nguồn lửa)
  it('Scenario 6: Provides emergency fire starting when lighter is soaked or out of gas', () => {
    const results = queryKnowledgeDataset('bật lửa bị rơi xuống suối ướt sũng');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('lăn bánh xe đá lửa');
    expect(top.answer).toContain('Pin và Giấy bạc');
    expect(top.answer).toContain('bông gòn');
  });

  // SCENARIO 7: Lost Phone & Dead Battery at Night (Mất điện thoại / hết pin)
  it('Scenario 7: Navigates by stars and signals SOS when phone is lost or dead at night', () => {
    const results = queryKnowledgeDataset('rơi mất điện thoại hết pin trong rừng đêm');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Bắc Đẩu');
    expect(top.answer).toContain('Nam Thập Tự');
    expect(top.answer).toContain('3 hồi ngắn');
  });

  // SCENARIO 8: Panic Attack on Knife-Edge Ridge (Cơn hoảng loạn co cứng sợ độ cao)
  it('Scenario 8: Coaches de-escalation for panic attacks on knife-edge ridges', () => {
    const results = queryKnowledgeDataset('bị hoảng loạn đóng cứng người trên sống lưng khủng long tà xùa');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Box Breathing');
    expect(top.answer).toContain('5-4-3-2-1');
    expect(top.answer).toContain('Tunnel Vision');
  });

  // SCENARIO 9: Unexpected Menstruation (Trekker nữ gặp kỳ kinh nguyệt đột xuất)
  it('Scenario 9: Advises female trekkers on hygiene and survival during sudden menstruation', () => {
    const results = queryKnowledgeDataset('con gái leo núi bị đến tháng bất ngờ');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Leave No Trace');
    expect(top.answer).toContain('túi zip');
    expect(top.answer).toContain('miếng giữ nhiệt');
    expect(top.answer).toContain('Sắt');
  });

  // SCENARIO 10: Asthma Attack & Hypoglycemia (Hen suyễn & tụt đường huyết)
  it('Scenario 10: Handles asthma attacks without inhaler and sudden hypoglycemia', () => {
    const results = queryKnowledgeDataset('người leo núi bị hen suyễn khó thở mất bình xịt');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Tripod Position');
    expect(top.answer).toContain('thở chúm môi');
    expect(top.answer).toContain('15-15');
  });

  // SCENARIO 11: Border Patrol & Missing ID (Vành đai biên giới & quên CCCD)
  it('Scenario 11: Explains protocol when encountering border patrol without physical ID', () => {
    const results = queryKnowledgeDataset('quên cccd khi gặp tuần tra biên phòng vành đai');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Thái độ hợp tác');
    expect(top.answer).toContain('VNeID');
    expect(top.answer).toContain('Porter');
  });

  // SCENARIO 12: Indigenous Taboos (Điều kiêng kỵ bản địa)
  it('Scenario 12: Advises on respecting ethnic minorities sacred customs and resolving taboos', () => {
    const results = queryKnowledgeDataset('phạm phải điều kiêng kỵ của người mông người dao trong rừng');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Bếp lửa');
    expect(top.answer).toContain('Cột thiêng');
    expect(top.answer).toContain('Rừng thiêng');
    expect(top.answer).toContain('tạ lỗi');
  });

  // SCENARIO 13: Wild Boars & Monkeys (Lợn rừng & khỉ cướp đồ)
  it('Scenario 13: Responds safely to wild boars and aggressive monkeys', () => {
    const results = queryKnowledgeDataset('chạm trán lợn rừng hung dữ khỉ cướp đồ');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Lợn rừng');
    expect(top.answer).toContain('KHÔNG QUAY LƯNG BỎ CHẠY');
    expect(top.answer).toContain('trèo lên cao');
    expect(top.answer).toContain('Dại (Rabies)');
  });

  // SCENARIO 14: Troll Q1 - "Đi dép tổ ong leo Fansipan"
  it('Scenario 14: Rejects troll question about wearing honeycomb slippers on Fansipan with safety logic', () => {
    const results = queryKnowledgeDataset('em đi dép tổ ong leo fansipan được không');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('TUYỆT ĐỐI KHÔNG');
    expect(top.answer).toContain('lật sơ mi');
    expect(top.answer).toContain('Mất ma sát');
    expect(top.answer).toContain('giày trekking cổ lửng');
  });

  // SCENARIO 15: Troll Q2 - "Mang loa kéo nướng BBQ lên đỉnh Fansipan"
  it('Scenario 15: Rejects troll request for BBQ charcoal & loudspeaker on national peaks', () => {
    const results = queryKnowledgeDataset('vác loa kéo mang bếp than hoa nướng bbq lên fansipan mở tiệc quẩy');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('HOÀN TOÀN BỊ CẤM');
    expect(top.answer).toContain('Nghị định 35/2019/NĐ-CP');
    expect(top.answer).toContain('Leave No Trace');
  });

  // SCENARIO 16: Troll Q3 - "Bẻ đỗ quyên hái lan rừng"
  it('Scenario 16: Denounces poaching wild rhododendrons and orchids from national parks', () => {
    const results = queryKnowledgeDataset('chặt bẻ cành đỗ quyên đào phong lan rừng mang về');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('VI PHẠM PHÁP LUẬT');
    expect(top.answer).toContain('Tỷ lệ sống gần như 0%');
    expect(top.answer).toContain('Leave No Trace');
  });

  // SCENARIO 17: Troll Q4 - "Lái xe máy lên đỉnh Pu Si Lung"
  it('Scenario 17: Clarifies physical impossibility of riding motorcycles to remote summits', () => {
    const results = queryKnowledgeDataset('lái xe máy xe cào cào lên tận đỉnh pu si lung');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('BẤT KHẢ THI');
    expect(top.answer).toContain('vách đá');
    expect(top.answer).toContain('cuốc bộ');
  });

  // SCENARIO 18: Jungle Leech Bites (Vắt rừng bu bám)
  it('Scenario 18: Guides safe leech removal without leaving mouthparts in skin', () => {
    const results = queryKnowledgeDataset('bị vắt rừng cắn khắp người cách gỡ vắt');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('TUYỆT ĐỐI KHÔNG giật mạnh');
    expect(top.answer).toContain('Hirudin');
    expect(top.answer).toContain('thuốc mỡ DEP');
  });

  // SCENARIO 19: Poisonous Mushrooms (Ngộ độc nấm rừng lạ)
  it('Scenario 19: Provides emergency triage for wild mushroom poisoning', () => {
    const results = queryKnowledgeDataset('ăn phải nấm rừng lạ đau bụng nôn mửa tiêu chảy');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Gây nôn');
    expect(top.answer).toContain('Than hoạt tính');
    expect(top.answer).toContain('Oresol');
  });

  // SCENARIO 20: Southern Heat Stroke (Sốc nhiệt núi Bà Đen)
  it('Scenario 20: Responds accurately to heat stroke during hot season climbs in the South', () => {
    const results = queryKnowledgeDataset('sốc nhiệt say nắng khi leo núi bà đen');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('SỐC NHIỆT');
    expect(top.answer).toContain('Làm mát tích cực');
    expect(top.answer).toContain('Cổ, Nách và Bẹn');
  });

  // SCENARIO 21: Fractured Leg on Cliff (Gãy xương cẳng chân)
  it('Scenario 21: Details field splinting of lower leg fracture using trekking poles', () => {
    const results = queryKnowledgeDataset('bị gãy xương cẳng chân ngoài vách đá');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Bất động trên một khớp và dưới một khớp');
    expect(top.answer).toContain('gậy trekking');
    expect(top.answer).toContain('Khớp Gối');
    expect(top.answer).toContain('Khớp Cổ Chân');
  });

  // SCENARIO 22: Bamboo Maze Trap (Lạc trong rừng trúc lùn)
  it('Scenario 22: Guides escaping circular walking traps in dense bamboo mazes', () => {
    const results = queryKnowledgeDataset('lạc trong mê cung rừng trúc lùn pu si lung');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Circular Walking Trap');
    expect(top.answer).toContain('đánh dấu đường đi lùi');
    expect(top.answer).toContain('Sống Núi (Ridge Line)');
  });

  // SCENARIO 23: Flash Flood Nightmare (Lũ quét ban đêm)
  it('Scenario 23: Warns and instructs immediate evacuation from flash floods', () => {
    const results = queryKnowledgeDataset('dấu hiệu nhận biết lũ quét và cách thoát hiểm');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('chạy lên sườn đồi cao');
    expect(top.answer).toContain('rời khỏi lòng suối');
  });

  // SCENARIO 24: Streams Near Me (Đi suối gần tôi)
  it('Scenario 24: Recommends real stream trails by region with 3 survival rules', () => {
    const results = queryKnowledgeDataset('gợi ý cung đi suối gần tôi tắm suối');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Núi Dinh');
    expect(top.answer).toContain('Suối Cửa Tử');
    expect(top.answer).toContain('LŨ QUÉT');
    expect(top.answer).toContain('50 mét');
  });

  // SCENARIO 25: Chill Cloud Hunting Without Rain (Mát mẻ mây nhiều không mưa chill)
  it('Scenario 25: Suggests cool, cloudy, rain-free scenic trails with cloud hunting weather formula', () => {
    const results = queryKnowledgeDataset('tìm địa điểm mát mẻ mây nhiều không mưa để đi chill chill');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.answer).toContain('Lảo Thẩn');
    expect(top.answer).toContain('Tà Xùa');
    expect(top.answer).toContain('Bidoup Núi Bà');
    expect(top.answer).toContain('BÍ QUYẾT SĂN BIỂN MÂY THÀNH CÔNG');
  });

  // SCENARIO 26: Pure SVG / Zero Emoji Mandate (Rule 12)
  it('Scenario 26: Ensures zero emojis are present across all knowledge answers', () => {
    const results = queryKnowledgeDataset('Fansipan');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((item) => {
      expect(removeEmojis(item.answer)).toBe(item.answer);
    });
  });
});
