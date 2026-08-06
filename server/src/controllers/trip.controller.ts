import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { TripPlanModel } from '../models/TripPlan';
import { UserModel } from '../models/User';
import { ActivityModel } from '../models/Activity';

// POST /api/trips - Create new trip recruitment plan
export const createTripPlan = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId;
    if (!creatorId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để mở chuyến ghép đoàn.' });
    }

    const {
      trailId,
      trailName,
      title,
      description,
      startDate,
      endDate,
      maxMembers,
      requirements,
      estimatedCost,
      meetingPoint,
      difficultyLevel,
      coverImage,
      tags,
    } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền tiêu đề và thời gian chuyến đi.' });
    }

    const trip = await TripPlanModel.create({
      creatorId: creatorId as any,
      trailId: trailId ? (trailId as any) : undefined,
      trailName: trailName || '',
      title,
      description: description || title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxMembers: maxMembers || 6,
      currentMembers: [creatorId as any], // Creator is automatically first member
      requirements: requirements || 'Lịch sự, trách nhiệm, tự túc đồ dùng cá nhân.',
      estimatedCost: estimatedCost || 'Chia đều chi phí thực tế',
      meetingPoint: meetingPoint || 'Sẽ chốt trong nhóm chat đoàn',
      difficultyLevel: difficultyLevel || 3,
      coverImage: coverImage || 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
      tags: tags || ['Trekking', 'Ghép Đoàn'],
      status: 'recruiting',
    });

    const creator = await UserModel.findById(creatorId);
    if (creator) {
      await ActivityModel.create({
        userId: creatorId as any,
        type: 'new_trip_plan',
        title: `${creator.fullName} vừa mở chuyến ghép đoàn mới: "${title}"`,
        targetType: 'trip_plan',
        targetId: (trip as any)._id.toString(),
        thumbnailUrl: (trip as any).coverImage,
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Mở chuyến ghép đoàn thành công! Bạn là trưởng đoàn.',
      data: trip,
    });
  } catch (err) {
    console.error('[Create Trip Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo chuyến ghép đoàn.' });
  }
};

// GET /api/trips - Get list of trip plans
export const getTripPlans = async (req: AuthRequest, res: Response) => {
  try {
    const { status = 'recruiting', page = 1, limit = 10 } = req.query;
    const query: any = {};
    if (status !== 'all') query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const trips = await TripPlanModel.find(query)
      .populate('creatorId', 'fullName avatarUrl reputationScore badges')
      .populate('currentMembers', 'fullName avatarUrl')
      .sort({ startDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await TripPlanModel.countDocuments(query);

    return res.json({
      success: true,
      data: trips,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error('[Get Trip Plans Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách chuyến ghép đoàn.' });
  }
};

// GET /api/trips/:id - Get single trip plan detail
export const getTripPlanById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trip = await TripPlanModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true })
      .populate('creatorId', 'fullName avatarUrl reputationScore badges phone bio')
      .populate('currentMembers', 'fullName avatarUrl reputationScore badges')
      .populate('pendingRequests.userId', 'fullName avatarUrl reputationScore');

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }

    return res.json({ success: true, data: trip });
  } catch (err) {
    console.error('[Get Trip Plan Detail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết chuyến đi.' });
  }
};

// POST /api/trips/:id/join - Request to join a trip plan
export const requestJoinTrip = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để xin tham gia đoàn.' });
    }

    const { id } = req.params;
    const { message } = req.body;

    const trip = await TripPlanModel.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }

    if (trip.status !== 'recruiting') {
      return res.status(400).json({ success: false, message: 'Chuyến đi này hiện đã đóng hoặc chốt danh sách.' });
    }

    const isMember = trip.currentMembers.some((m) => m.toString() === userId.toString());
    if (isMember) {
      return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của đoàn này rồi.' });
    }

    const hasPending = trip.pendingRequests.some((r) => r.userId.toString() === userId.toString());
    if (hasPending) {
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu rồi, vui lòng chờ trưởng đoàn duyệt.' });
    }

    trip.pendingRequests.push({
      userId: userId as any,
      message: message || 'Chào trưởng đoàn, em muốn tham gia đi cùng đoàn!',
      requestedAt: new Date(),
    });

    await trip.save();

    return res.json({ success: true, message: 'Đã gửi yêu cầu ghép đoàn tới trưởng đoàn thành công!' });
  } catch (err) {
    console.error('[Request Join Trip Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu tham gia.' });
  }
};

// PUT /api/trips/:id/approve - Creator approves a pending member request
export const approveJoinTrip = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId;
    const { id } = req.params;
    const { applicantUserId } = req.body;

    const trip = await TripPlanModel.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }

    if (trip.creatorId.toString() !== creatorId?.toString()) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn mới có quyền duyệt thành viên.' });
    }

    // Remove from pending
    trip.pendingRequests = trip.pendingRequests.filter((r) => r.userId.toString() !== applicantUserId);

    // Add to members if not present
    if (!trip.currentMembers.some((m) => m.toString() === applicantUserId)) {
      trip.currentMembers.push(applicantUserId as any);
    }

    if (trip.currentMembers.length >= trip.maxMembers) {
      trip.status = 'full';
    }

    await trip.save();

    return res.json({ success: true, message: 'Đã duyệt thành viên vào đoàn thành công!' });
  } catch (err) {
    console.error('[Approve Join Trip Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi duyệt thành viên.' });
  }
};
