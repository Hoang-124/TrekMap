import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createItinerary, getItineraryByShareToken } from '../controllers/itinerary.controller.js';
import { toggleFollowUser, checkFollowStatus } from '../controllers/follow.controller.js';
import { createTripReport } from '../controllers/tripReport.controller.js';
import { ItineraryModel } from '../models/Itinerary.js';

describe('Senior QA Integration Suite: Expeditions, Follow & Trip Reports', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Itinerary Sharing Engine (P2-13)', () => {
    it('should reject itinerary creation if required fields are missing', async () => {
      const req: any = {
        headers: {},
        body: {
          title: '', // Missing title
          trailId: '', // Missing trailId
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await createItinerary(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Vui lòng điền đầy đủ'),
        })
      );
    });

    it('should successfully create an expedition itinerary and generate a unique shareToken', async () => {
      // Mock ItineraryModel.prototype.save to resolve immediately without buffer timeout
      vi.spyOn(ItineraryModel.prototype, 'save').mockResolvedValue({} as any);

      const req: any = {
        headers: {},
        body: {
          trailId: 'trail-1',
          title: 'Hành Trình Chinh Phục Fansipan 2N1D',
          startDate: '2026-10-15',
          memberCount: 4,
          timelineSteps: [
            { day: 1, time: '06:00', activity: 'Xuất phát từ Trạm Tôn', location: 'Trạm Tôn', altitudeM: 1900 },
            { day: 1, time: '12:00', activity: 'Nghỉ trưa ăn cơm nắm', location: 'Điểm 2200m', altitudeM: 2200 },
            { day: 1, time: '17:30', activity: 'Hạ trại lán 2800m', location: 'Lán 2800m', altitudeM: 2800 },
          ],
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await createItinerary(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.title).toBe('Hành Trình Chinh Phục Fansipan 2N1D');
      expect(responseData.data.shareToken).toBeDefined();
      expect(responseData.shareUrl).toBeDefined();
    });

    it('should return 404 for a non-existent itinerary share token', async () => {
      vi.spyOn(ItineraryModel, 'findOne').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      } as any);

      const req: any = {
        params: { shareToken: 'non-existent-token-9999' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await getItineraryByShareToken(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Không tìm thấy lịch trình'),
        })
      );
    });
  });

  describe('Trekker Follow & Social Graph Engine', () => {
    it('should reject follow requests if user is unauthenticated', async () => {
      const req: any = {
        user: undefined,
        params: { id: '650000000000000000000002' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await toggleFollowUser(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Bạn cần đăng nhập'),
        })
      );
    });

    it('should prevent users from self-following', async () => {
      const req: any = {
        user: { userId: '650000000000000000000001' },
        params: { id: '650000000000000000000001' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await toggleFollowUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Không thể tự theo dõi chính mình'),
        })
      );
    });

    it('should return isFollowing: false if unauthenticated or not followed', async () => {
      const req: any = {
        user: undefined,
        params: { id: '650000000000000000000002' },
      };
      const res: any = {
        json: vi.fn(),
      };

      await checkFollowStatus(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, isFollowing: false });
    });
  });

  describe('Trip Report Expedition Diary Submission', () => {
    it('should reject trip report creation without authentication', async () => {
      const req: any = {
        user: undefined,
        body: { title: 'Test Report' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await createTripReport(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject trip report if title, trailId or content is missing', async () => {
      const req: any = {
        user: { userId: '650000000000000000000001' },
        body: {
          trailId: '',
          title: '',
          content: '',
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await createTripReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Thiếu thông tin'),
        })
      );
    });
  });
});
