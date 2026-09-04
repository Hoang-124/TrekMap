import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ItineraryModel } from '../models/Itinerary.js';
import { verifyToken } from '../utils/auth.js';

const inMemoryItineraries: any[] = [];

export const createItinerary = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.substring(7));
      if (decoded) userId = decoded.userId;
    }

    const { trailId, title, startDate, endDate, memberCount, timelineSteps } = req.body;

    if (!trailId || !title || !startDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin chuyến đi' });
    }

    const shareToken = `trek-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    const isMongoId = mongoose.Types.ObjectId.isValid(trailId);
    const mongoTrailId = isMongoId ? new mongoose.Types.ObjectId(trailId) : new mongoose.Types.ObjectId('650000000000000000000002');
    const mongoUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId('650000000000000000000001');

    const itineraryData = {
      _id: new mongoose.Types.ObjectId(),
      creatorId: mongoUserId,
      trailId: mongoTrailId,
      rawTrailId: trailId,
      title,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(startDate),
      memberCount: memberCount || 1,
      timelineSteps: timelineSteps || [],
      shareToken,
      status: 'active',
      createdAt: new Date(),
    };

    try {
      const newItinerary = new ItineraryModel(itineraryData);
      await newItinerary.save();
    } catch (saveErr) {
      console.warn('MongoDB save timeout, storing itinerary in-memory fallback:', saveErr);
      inMemoryItineraries.push(itineraryData);
    }

    return res.status(201).json({
      success: true,
      data: itineraryData,
      shareUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/#itinerary/${shareToken}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi khi tạo lịch trình' });
  }
};

export const getItineraryByShareToken = async (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;
    let itinerary: any = null;

    try {
      itinerary = await ItineraryModel.findOne({ shareToken }).populate('trailId').exec();
    } catch (e) {}

    if (!itinerary) {
      itinerary = inMemoryItineraries.find((item) => item.shareToken === shareToken);
    }

    if (!itinerary) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
    }

    return res.json({ success: true, data: itinerary });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi truy vấn lịch trình' });
  }
};
