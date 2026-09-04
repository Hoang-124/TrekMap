import { describe, it, expect } from 'vitest';
import {
  queryKnowledgeDataset,
  removeVietnameseDiacritics,
  masterKnowledgeDataset,
  VIETNAM_PEAKS_MATRIX,
} from '../data/trekkerKnowledgeDataset.js';
import { getAiResponse, removeEmojis } from '../services/ai.service.js';

describe('TrekCopilot AI & Master Knowledge Engine', () => {
  describe('Vietnamese Accent-Insensitive Normalization', () => {
    it('should correctly strip Vietnamese diacritics', () => {
      expect(removeVietnameseDiacritics('Lảo Thẩn')).toBe('lao than');
      expect(removeVietnameseDiacritics('Sốc độ cao')).toBe('soc do cao');
      expect(removeVietnameseDiacritics('Kỳ Quan San (Bạch Mộc Lương Tử)')).toBe('ky quan san (bach moc luong tu)');
      expect(removeVietnameseDiacritics('Đỉnh Tây Côn Lĩnh')).toBe('dinh tay con linh');
    });
  });

  describe('Master Knowledge Base Data Quality', () => {
    it('should cover all 25 top Vietnamese mountain peaks', () => {
      expect(VIETNAM_PEAKS_MATRIX.length).toBe(25);
      VIETNAM_PEAKS_MATRIX.forEach((peak) => {
        expect(peak.name).toBeDefined();
        expect(peak.altitude).toBeGreaterThan(400);
        expect(peak.rescue).toBeDefined();
        expect(peak.rescue).not.toContain('555-');
      });
    });

    it('should contain rich dataset items across multiple categories', () => {
      expect(masterKnowledgeDataset.length).toBeGreaterThan(150);

      const categories = new Set(masterKnowledgeDataset.map((i) => i.category));
      expect(categories.has('trail_specific')).toBe(true);
      expect(categories.has('emergency_sos')).toBe(true);
      expect(categories.has('fitness_training')).toBe(true);
      expect(categories.has('gear_equipment')).toBe(true);
      expect(categories.has('nutrition_hydration')).toBe(true);
      expect(categories.has('camping_shelters')).toBe(true);
    });
  });

  describe('Intelligent Query Matching (Accented & Non-Accented)', () => {
    it('should retrieve Lảo Thẩn information with non-accented query "lao than"', () => {
      const results = queryKnowledgeDataset('leo lao than co kho khong', 3);
      expect(results.length).toBeGreaterThan(0);
      const matched = results.find((r) => r.trailName?.includes('Lảo Thẩn') || r.question.includes('Lảo Thẩn'));
      expect(matched).toBeDefined();
      expect(matched?.answer).toContain('Lảo Thẩn');
    });

    it('should retrieve Acute Mountain Sickness (AMS) guide with synonym "say do cao" or "ams"', () => {
      const results = queryKnowledgeDataset('bi say do cao ams thi lam sao', 2);
      expect(results.length).toBeGreaterThan(0);
      const amsItem = results.find((r) => r.answer.includes('Hạ cao độ') || r.question.includes('Sốc độ cao'));
      expect(amsItem).toBeDefined();
      expect(amsItem?.answer).toContain('300m - 500m');
    });

    it('should retrieve S.T.O.P survival protocol when asked about lost in forest "lac duong"', () => {
      const results = queryKnowledgeDataset('bi lac duong trong rung phai lam gi', 2);
      expect(results.length).toBeGreaterThan(0);
      const stopItem = results.find((r) => r.answer.includes('S.T.O.P') || r.answer.includes('Dừng lại ngay'));
      expect(stopItem).toBeDefined();
      expect(stopItem?.answer).toContain('3 hồi ngắn');
    });

    it('should retrieve snake bite first-aid protocol with "ran can"', () => {
      const results = queryKnowledgeDataset('so cuu khi bi ran doc can', 2);
      expect(results.length).toBeGreaterThan(0);
      const snakeItem = results.find((r) => r.answer.includes('rắn cắn') || r.answer.includes('Bất động'));
      expect(snakeItem).toBeDefined();
      expect(snakeItem?.answer).toContain('thấp hơn tim');
    });

    it('should retrieve 3-layer clothing protocol with "3 lop ao"', () => {
      const results = queryKnowledgeDataset('quy tac 3 lop ao giu am', 2);
      expect(results.length).toBeGreaterThan(0);
      const layerItem = results.find((r) => r.answer.includes('Base Layer') || r.question.includes('3 lớp'));
      expect(layerItem).toBeDefined();
    });
  });

  describe('TrekCopilot AI Response Generator & Safety Rules', () => {
    it('should respond to greetings with personalized welcome and quick reply suggestions', async () => {
      const res = await getAiResponse({
        message: 'Xin chào TrekCopilot AI',
        userName: 'Hải Đăng',
      });

      expect(res.reply).toBeDefined();
      expect(res.reply).toContain('Hải Đăng');
      expect(res.actions).toBeDefined();
      expect(res.actions?.some((a) => a.type === 'quick_reply')).toBe(true);
    });

    it('should strictly follow Pure SVG mandate (Zero Emojis in reply)', async () => {
      const res = await getAiResponse({
        message: 'Tư vấn cho mình cách leo Fansipan an toàn',
      });

      // Assert no emoji characters exist
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;
      expect(emojiRegex.test(res.reply)).toBe(false);
    });

    it('should attach a trail card when discussing a specific known trail', async () => {
      const res = await getAiResponse({
        message: 'Cung Lảo Thẩn Y Tý đi như thế nào?',
      });

      expect(res.actions).toBeDefined();
      const trailCardAction = res.actions?.find((a) => a.type === 'trail_card');
      expect(trailCardAction).toBeDefined();
      expect(trailCardAction?.trailName).toContain('Lảo Thẩn');
    });

    it('should attach emergency quick replies when query indicates dangerous situation', async () => {
      const res = await getAiResponse({
        message: 'Bạn mình bị lạc đường và sốc độ cao nôn mửa liên tục, cứu hộ gấp!',
      });

      expect(res.actions).toBeDefined();
      const quickReplyAction = res.actions?.find((a) => a.type === 'quick_reply');
      expect(quickReplyAction).toBeDefined();
      expect(res.reply.toLowerCase()).toContain('hạ');
    });

    it('should correctly prioritize Da Nang streams when user specifies Da Nang location', async () => {
      const res = await getAiResponse({
        message: 'tôi đâng ở đà nẵng mà sao lại giới thiệu địa điểm ở hồ chí minh',
      });

      expect(res.reply).toBeDefined();
      expect(res.reply).toContain('Đà Nẵng');
      expect(res.reply).toContain('Giếng Trời');

      // Trail card must NOT be Núi Dinh in Vũng Tàu; must be Giếng Trời or Bạch Mã in Da Nang/Central VN
      const trailCardAction = res.actions?.find((a) => a.type === 'trail_card');
      expect(trailCardAction).toBeDefined();
      expect(trailCardAction?.trailId).toBe('trail-giengtroi');
      expect(trailCardAction?.trailName).toContain('Giếng Trời');

      // Suggestions should feature Da Nang & Central stream options
      const quickReplyAction = res.actions?.find((a) => a.type === 'quick_reply');
      expect(quickReplyAction).toBeDefined();
      expect(quickReplyAction?.suggestions?.some((s) => s.includes('Giếng Trời') || s.includes('Đà Nẵng'))).toBe(true);
    });

    it('should recommend Giếng Trời when asking for streams in Da Nang', async () => {
      const res = await getAiResponse({
        message: 'gợi ý suối thác ở đà nẵng cắm trại',
      });

      expect(res.reply).toContain('Giếng Trời');
      const trailCardAction = res.actions?.find((a) => a.type === 'trail_card');
      expect(trailCardAction?.trailId).toBe('trail-giengtroi');
    });
  });
});
