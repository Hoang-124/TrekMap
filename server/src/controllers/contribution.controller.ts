import { Request, Response } from 'express';
import { Contribution } from '../models/Contribution.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { NotificationModel } from '../models/Notification.js';
import { emitToUser } from '../config/socket.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

const inMemoryContributions: any[] = [];

// GET /api/contributions - Get all contributions
export const getContributions = async (req: Request, res: Response) => {
  try {
    let list: any[] = [];
    try {
      const contribQuery = Contribution.find().maxTimeMS(200).lean().sort({ createdAt: -1 });
      const timeoutRace = new Promise<any[]>((_, reject) =>
        setTimeout(() => reject(new Error('Contrib DB query timeout')), 150)
      );
      list = await Promise.race([contribQuery, timeoutRace]);
    } catch (dbErr) {
      list = [...inMemoryContributions];
    }
    if (!list || list.length === 0) {
      list = [...inMemoryContributions];
    }
    return res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    console.error('[Get Contributions Error]:', err);
    return res.json({ success: true, count: inMemoryContributions.length, data: inMemoryContributions });
  }
};

// POST /api/contributions - Create or upsert a contribution (Authenticated Users)
export const createContribution = async (req: AuthRequest, res: Response) => {
  try {
    const contribData = req.body;
    if (!contribData.name || !contribData.province) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tên cung đường hoặc tỉnh thành.' });
    }

    const contribId = contribData.id || `contrib-${Date.now()}`;
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;

    let existing: any = null;
    try {
      existing = await Contribution.findOne({ id: contribId }).maxTimeMS(300);
    } catch (dbErr) {
      existing = inMemoryContributions.find((c) => c.id === contribId);
    }

    if (existing) {
      const isOwner = (currentUserId && existing.userId && existing.userId.toString() === currentUserId) ||
                      (currentUserEmail && existing.authorEmail === currentUserEmail);
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài đóng góp này.' });
      }

      Object.assign(existing, contribData);
      try { await existing.save(); } catch (e) {}

      const memIdx = inMemoryContributions.findIndex((c) => c.id === contribId);
      if (memIdx >= 0) inMemoryContributions[memIdx] = existing;

      return res.json({ success: true, message: 'Đã cập nhật bài đóng góp!', data: existing });
    }

    const newContribData: any = {
      ...contribData,
      id: contribId,
      status: contribData.status || 'pending',
      userId: currentUserId || contribData.userId,
      authorEmail: currentUserEmail || contribData.authorEmail,
      createdAt: new Date(),
    };

    try {
      const newContribDoc = new Contribution(newContribData);
      await newContribDoc.save();
    } catch (e) {}

    inMemoryContributions.unshift(newContribData);

    // Trigger Notification for ALL Admins
    try {
      const admins = await UserModel.find({ role: 'admin' }).maxTimeMS(300);
      for (const admin of admins) {
        const notif = new NotificationModel({
          recipient: admin._id,
          type: 'new_contribution_pending',
          title: 'Bài đóng góp mới chờ duyệt',
          message: `Thành viên ${contribData.authorName || 'người dùng'} vừa gửi bài đóng góp "${contribData.name}".`,
          link: '/#admin',
          relatedId: admin._id,
          isRead: false,
        });
        await notif.save();
        emitToUser(admin._id.toString(), 'newNotification', notif);
      }
    } catch (notifErr) {}

    return res.status(201).json({ success: true, message: 'Đã lưu bài đóng góp mới thành công!', data: newContribData });
  } catch (err) {
    console.error('[Create Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lưu bài đóng góp.' });
  }
};

// PUT /api/contributions/:id - Update contribution status or details
export const updateContribution = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;
    const isAdmin = req.user?.role === 'admin';

    let existing: any = null;
    try {
      existing = await Contribution.findOne({ id }).maxTimeMS(300);
    } catch (dbErr) {
      existing = inMemoryContributions.find((c) => c.id === id);
    }

    if (!existing) {
      existing = inMemoryContributions.find((c) => c.id === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài đóng góp để cập nhật.' });
    }

    // Checking status change: ONLY Admin can approve/reject contributions
    if (update.status && update.status !== existing.status && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền phê duyệt hoặc từ chối bài đóng góp.' });
    }

    // Ownership check for editing contribution content
    const isOwner = (currentUserId && existing.userId && existing.userId.toString() === currentUserId) ||
                    (currentUserEmail && existing.authorEmail === currentUserEmail);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài đóng góp này.' });
    }

    Object.assign(existing, update);

    try {
      await Contribution.findOneAndUpdate({ id }, update, { new: true });
    } catch (e) {}

    const idx = inMemoryContributions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      inMemoryContributions[idx] = existing;
    } else {
      inMemoryContributions.unshift(existing);
    }

    // If Admin approves the contribution, auto-upsert into MongoDB `trails` collection as well
    if (update.status === 'approved' || existing.status === 'approved') {
      try {
        await TrailModel.findOneAndUpdate(
          { name: existing.name },
          {
            name: existing.name,
            altNames: [],
            region: existing.region || 'Miền Bắc',
            province: existing.province || 'Lào Cai',
            district: existing.district || 'Sa Pa',
            difficultyLevel: existing.difficultyLevel || 3,
            distanceKm: existing.distanceKm || 15,
            elevationGainM: existing.elevationGainM || 800,
            maxAltitudeM: existing.maxAltitudeM || 2000,
            durationDays: Math.ceil((existing.distanceKm || 15) / 10),
            durationHoursNote: existing.durationHoursNote || '1 ngày',
            coverImage: existing.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
            galleryImages: [existing.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'],
            startLocation: {
              type: 'Point',
              coordinates: [existing.startLng || 103.8438, existing.startLat || 22.3364],
            },
            startLat: existing.startLat || 22.3364,
            startLng: existing.startLng || 103.8438,
            endLat: existing.endLat || 22.3512,
            endLng: existing.endLng || 103.864,
            description: existing.description || '',
            transportationInfo: existing.transportationInfo || 'Phương tiện tự túc',
            permitRequired: !!existing.permitRequired,
            permitInfo: existing.permitInfo || '',
            rescueContact: {
              name: 'Hạt Kiểm Lâm ' + (existing.province || 'Địa phương'),
              phone: '114 / SOS 0987-654-321',
              rangerContact: 'Trạm Kiểm Lâm ' + (existing.district || 'Cửa Rừng'),
            },
            rating: 5.0,
            reviewCount: 1,
            hasCampsite: !!existing.hasCampsite,
            hasWaterSource: !!existing.hasWaterSource,
            kidFriendly: !!existing.kidFriendly,
            status: 'approved',
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (trailErr) {}
    }

    return res.json({ success: true, message: 'Đã cập nhật bài đóng góp thành công!', data: existing });
  } catch (err) {
    console.error('[Update Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật bài đóng góp.' });
  }
};

// DELETE /api/contributions/:id - Delete a contribution
export const deleteContribution = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;
    const isAdmin = req.user?.role === 'admin';

    let existing: any = null;
    try {
      existing = await Contribution.findOne({ id }).maxTimeMS(300);
    } catch (dbErr) {
      existing = inMemoryContributions.find((c) => c.id === id);
    }

    if (!existing) {
      existing = inMemoryContributions.find((c) => c.id === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài đóng góp để xóa.' });
    }

    const isOwner = (currentUserId && existing.userId && existing.userId.toString() === currentUserId) ||
                    (currentUserEmail && existing.authorEmail === currentUserEmail);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài đóng góp này.' });
    }

    try {
      await Contribution.findOneAndDelete({ id });
    } catch (e) {}

    const idx = inMemoryContributions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      inMemoryContributions.splice(idx, 1);
    }

    return res.json({ success: true, message: 'Đã xóa bài đóng góp thành công!' });
  } catch (err) {
    console.error('[Delete Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa bài đóng góp.' });
  }
};
