import { Request, Response } from 'express';
import { Contribution } from '../models/Contribution.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { NotificationModel } from '../models/Notification.js';
import { emitToUser } from '../config/socket.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { awardReputationPoints, REPUTATION_POINTS } from '../utils/reputation.js';
import { sendNotification, notifyAdmins } from '../utils/notification.js';

const inMemoryContributions: any[] = [];

// GET /api/contributions - Get all contributions
export const getContributions = async (req: Request, res: Response) => {
  try {
    let list: any[] = [];
    try {
      list = await Contribution.find().lean().sort({ createdAt: -1 });
    } catch (dbErr) {
      list = [...inMemoryContributions];
    }
    if (!list || list.length === 0) {
      list = [...inMemoryContributions];
    }

    // Enrich live author avatar & name from UserModel
    try {
      const userIds = list.map((c) => c.userId).filter(Boolean);
      const userEmails = list.map((c) => c.authorEmail).filter(Boolean);
      const users = await UserModel.find({
        $or: [
          { _id: { $in: userIds } },
          { email: { $in: userEmails } },
        ],
      }).lean();

      const userMap = new Map<string, any>();
      users.forEach((u) => {
        userMap.set(u._id.toString(), u);
        if (u.email) userMap.set(u.email.toLowerCase(), u);
      });

      list = list.map((c) => {
        const matchedUser = (c.userId && userMap.get(c.userId.toString())) ||
                            (c.authorEmail && userMap.get(c.authorEmail.toLowerCase()));
        if (matchedUser) {
          return {
            ...c,
            authorName: matchedUser.fullName || c.authorName,
            authorAvatar: matchedUser.avatarUrl || c.authorAvatar,
            authorEmail: matchedUser.email || c.authorEmail,
          };
        }
        return c;
      });
    } catch (enrichErr) {}

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
    // Validation
    if (!contribData.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên cung đường chính.' });
    }
    if (!contribData.province?.trim() || !contribData.district?.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Tỉnh/Thành phố và Phường/Xã.' });
    }
    if (!contribData.distanceKm || contribData.distanceKm <= 0) {
      return res.status(400).json({ success: false, message: 'Độ dài cung đường phải lớn hơn 0 km.' });
    }
    if (!contribData.maxAltitudeM || contribData.maxAltitudeM <= 0) {
      return res.status(400).json({ success: false, message: 'Cao độ đỉnh phải lớn hơn 0 m.' });
    }

    const contribId = contribData.id || `contrib-${Date.now()}`;
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;

    // Fetch live user from Database
    let authorUser: any = null;
    try {
      if (currentUserId) {
        authorUser = await UserModel.findById(currentUserId);
      }
      if (!authorUser && currentUserEmail) {
        authorUser = await UserModel.findOne({ email: currentUserEmail });
      }
    } catch (uErr) {}

    const resolvedAuthorName = authorUser?.fullName || contribData.authorName || (req.user as any)?.fullName || 'Trekker Đóng Góp';
    const resolvedAuthorAvatar = authorUser?.avatarUrl || contribData.authorAvatar || (req.user as any)?.avatarUrl || '';
    const resolvedAuthorEmail = authorUser?.email || currentUserEmail || contribData.authorEmail || '';

    const savedDoc = await Contribution.findOneAndUpdate(
      { id: contribId },
      {
        ...contribData,
        id: contribId,
        status: contribData.status || 'pending',
        userId: currentUserId || contribData.userId,
        authorEmail: resolvedAuthorEmail,
        authorName: resolvedAuthorName,
        authorAvatar: resolvedAuthorAvatar,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const memIdx = inMemoryContributions.findIndex((c) => c.id === contribId);
    if (memIdx >= 0) {
      inMemoryContributions[memIdx] = savedDoc.toObject();
    } else {
      inMemoryContributions.unshift(savedDoc.toObject());
    }

    // Trigger Notification for ALL Admins
    try {
      await notifyAdmins({
        sender: {
          id: currentUserId,
          name: resolvedAuthorName,
          avatarUrl: resolvedAuthorAvatar,
        },
        type: 'contribution_pending',
        title: 'Bài đóng góp mới chờ duyệt',
        message: `Thành viên ${resolvedAuthorName} vừa gửi bài đóng góp "${contribData.name}".`,
        link: '/admin',
        relatedId: contribId,
      });
    } catch (notifErr) {}

    console.log(`✅ [MongoDB Contributions]: Successfully saved contribution "${contribData.name}" (ID: ${contribId}) for author "${resolvedAuthorName}" to MongoDB!`);
    return res.status(201).json({
      success: true,
      message: 'Đã lưu bài đóng góp mới vào Database thành công!',
      data: savedDoc,
    });
  } catch (err: any) {
    console.error('[Create Contribution Error]:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Không thể lưu bài đóng góp vào Database.' });
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

    const previousStatus = existing.status;

    // Ownership check for editing contribution content
    const isOwner = (currentUserId && existing.userId && existing.userId.toString() === currentUserId) ||
                    (currentUserEmail && existing.authorEmail === currentUserEmail);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài đóng góp này.' });
    }

    Object.assign(existing, update);

    try {
      await Contribution.findOneAndUpdate({ id }, update, { new: true });
    } catch (e) {
      console.error('Contribution update DB error:', e);
    }

    const idx = inMemoryContributions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      inMemoryContributions[idx] = existing;
    } else {
      inMemoryContributions.unshift(existing);
    }

    // If Admin approves the contribution, auto-upsert into MongoDB `trails` collection as well
    if (update.status === 'approved' && previousStatus !== 'approved') {
      try {
        const startLat = Number(existing.startLat) || 22.3364;
        const startLng = Number(existing.startLng) || 103.8438;
        const endLat = Number(existing.endLat) || 22.3512;
        const endLng = Number(existing.endLng) || 103.864;

        const validGpx = (existing.gpxTrack && Array.isArray(existing.gpxTrack) && existing.gpxTrack.length > 0)
          ? existing.gpxTrack
          : [
              [startLat, startLng],
              [endLat, endLng],
            ];

        await TrailModel.findOneAndUpdate(
          { name: existing.name },
          {
            name: existing.name,
            altNames: existing.altNames || [],
            region: existing.region || 'Miền Bắc',
            province: existing.province || 'Lào Cai',
            district: existing.district || 'Sa Pa',
            difficultyLevel: Number(existing.difficultyLevel) || 3,
            difficultyNote: existing.difficultyNote || '',
            distanceKm: Number(existing.distanceKm) || 15,
            elevationGainM: Number(existing.elevationGainM) || 800,
            maxAltitudeM: Number(existing.maxAltitudeM) || 2000,
            durationDays: Number(existing.durationDays) || Math.ceil((Number(existing.distanceKm) || 15) / 10),
            durationHoursNote: existing.durationHoursNote || '1 ngày',
            coverImage: existing.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
            galleryImages: existing.galleryImages && existing.galleryImages.length > 0 ? existing.galleryImages : [existing.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'],
            startLocation: {
              type: 'Point',
              coordinates: [startLng, startLat],
            },
            startLat,
            startLng,
            endLat,
            endLng,
            gpxTrack: validGpx,
            waypoints: existing.waypoints || [],
            description: existing.description || 'Cung đường được đóng góp bởi cộng đồng Trekker TrekMap.',
            transportationInfo: existing.transportationInfo || 'Phương tiện tự túc',
            permitRequired: !!existing.permitRequired,
            permitInfo: existing.permitInfo || '',
            rescueContact: existing.rescueContact?.phone ? existing.rescueContact : {
              name: 'Hạt Kiểm Lâm ' + (existing.province || 'Địa phương'),
              phone: '114 / 115 (Cứu nạn & Cấp cứu 24/7)',
              rangerContact: 'Trạm Kiểm Lâm ' + (existing.district || 'Cửa Rừng'),
            },
            rating: 0,
            reviewCount: 0,
            hasCampsite: existing.hasCampsite !== undefined ? !!existing.hasCampsite : true,
            hasWaterSource: existing.hasWaterSource !== undefined ? !!existing.hasWaterSource : true,
            kidFriendly: existing.kidFriendly !== undefined ? !!existing.kidFriendly : false,
            bestMonths: Array.isArray(existing.bestMonths) && existing.bestMonths.length > 0 ? existing.bestMonths : [10, 11, 12, 1, 2, 3, 4],
            avoidMonths: Array.isArray(existing.avoidMonths) ? existing.avoidMonths : [],
            status: 'approved',
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`✅ [MongoDB Auto-Publish Trail]: Trail "${existing.name}" is now live in MongoDB 'trails' collection!`);
      } catch (trailErr) {
        console.error('⚠️ [MongoDB Trail Publish Error]:', trailErr);
      }

      // Award +50 reputation points & add "Người Đóng Góp" badge to author
      try {
        const authorUser = await UserModel.findOne({
          $or: [
            ...(existing.userId ? [{ _id: existing.userId }] : []),
            ...(existing.authorEmail ? [{ email: existing.authorEmail }] : []),
          ],
        });
        if (authorUser) {
          await awardReputationPoints(authorUser._id.toString(), REPUTATION_POINTS.CONTRIBUTE_TRAIL, 'Bài đóng góp cung đường được duyệt');
          if (!authorUser.badges.includes('Người Đóng Góp')) {
            authorUser.badges.push('Người Đóng Góp');
            await authorUser.save();
          }

          // Send approval notification
          await sendNotification({
            recipientId: authorUser._id.toString(),
            type: 'contribution_approved',
            category: 'moderation',
            title: 'Bài đóng góp cung đường được duyệt!',
            message: `Chúc mừng! Bài đóng góp "${existing.name}" của bạn đã được Admin phê duyệt công khai và nhận +50 điểm uy tín.`,
            link: `/#trail/${existing.id || existing._id}`,
            relatedId: existing._id || existing.id,
          });
        }
      } catch (repErr) {}
    } else if (update.status === 'rejected' && previousStatus !== 'rejected') {
      // Send rejection notification
      try {
        const authorUser = await UserModel.findOne({
          $or: [
            ...(existing.userId ? [{ _id: existing.userId }] : []),
            ...(existing.authorEmail ? [{ email: existing.authorEmail }] : []),
          ],
        });
        if (authorUser) {
          await sendNotification({
            recipientId: authorUser._id.toString(),
            type: 'contribution_rejected',
            category: 'moderation',
            title: 'Bài đóng góp chưa đạt yêu cầu',
            message: `Rất tiếc, bài đóng góp "${existing.name}" chưa thể công khai. Vui lòng kiểm tra lại thông tin tọa độ & giấy phép.`,
            link: '/contribute',
            relatedId: existing._id || existing.id,
          });
        }
      } catch (rejErr) {}
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
