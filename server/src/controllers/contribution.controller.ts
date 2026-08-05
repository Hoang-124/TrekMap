import { Request, Response } from 'express';
import { Contribution } from '../models/Contribution.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { NotificationModel } from '../models/Notification.js';
import { emitToUser } from '../config/socket.js';

// GET /api/contributions - Get all contributions from MongoDB
export const getContributions = async (req: Request, res: Response) => {
  try {
    const list = await Contribution.find().sort({ createdAt: -1 });
    return res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    console.error('[Get Contributions Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách đóng góp.' });
  }
};

// POST /api/contributions - Create or upsert a contribution in MongoDB
export const createContribution = async (req: Request, res: Response) => {
  try {
    const contribData = req.body;
    if (!contribData.name || !contribData.province) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tên cung đường hoặc tỉnh thành.' });
    }

    const contribId = contribData.id || `contrib-${Date.now()}`;

    const existing = await Contribution.findOne({ id: contribId });
    if (existing) {
      Object.assign(existing, contribData);
      await existing.save();
      return res.json({ success: true, message: 'Đã cập nhật bài đóng góp trong MongoDB!', data: existing });
    }

    const newContrib = new Contribution({ ...contribData, id: contribId });
    await newContrib.save();

    // Trigger Notification for ALL Admins
    try {
      const admins = await UserModel.find({ role: 'admin' });
      for (const admin of admins) {
        const notif = new NotificationModel({
          recipient: admin._id,
          type: 'new_contribution_pending',
          title: 'Bài đóng góp mới chờ duyệt',
          message: `Thành viên ${contribData.authorName || 'người dùng'} vừa gửi bài đóng góp "${contribData.name}".`,
          link: '/#admin',
          relatedId: newContrib._id,
          isRead: false,
        });
        await notif.save();
        emitToUser(admin._id.toString(), 'newNotification', notif);
      }
    } catch (notifErr) {
      console.warn('⚠️ [Admin Notification Trigger Warning]:', notifErr);
    }

    return res.status(201).json({ success: true, message: 'Đã lưu bài đóng góp mới vào MongoDB!', data: newContrib });
  } catch (err) {
    console.error('[Create Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lưu bài đóng góp vào MongoDB.' });
  }
};

// PUT /api/contributions/:id - Update contribution status or details in MongoDB
export const updateContribution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const update = req.body;

    const updated = await Contribution.findOneAndUpdate({ id }, update, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài đóng góp để cập nhật.' });
    }

    // Trigger Notification for Author on Approved / Rejected
    if (update.status === 'approved' || update.status === 'rejected') {
      try {
        let authorUser = null;
        if (updated.userId) {
          authorUser = await UserModel.findById(updated.userId);
        }
        if (!authorUser && updated.authorEmail) {
          authorUser = await UserModel.findOne({ email: updated.authorEmail });
        }

        if (authorUser) {
          const isApproved = update.status === 'approved';
          const notif = new NotificationModel({
            recipient: authorUser._id,
            type: isApproved ? 'contribution_approved' : 'contribution_rejected',
            title: isApproved ? 'Bài đóng góp đã được BQT duyệt!' : 'Bài đóng góp bị BQT từ chối',
            message: isApproved
              ? `Bài đóng góp "${updated.name}" của bạn đã được BQT phê duyệt và công khai lên bản đồ 3D!`
              : `Bài đóng góp "${updated.name}" của bạn không đạt yêu cầu kiểm duyệt BQT.`,
            link: isApproved ? '/#home' : '/#contribute',
            relatedId: updated._id,
            isRead: false,
          });
          await notif.save();
          emitToUser(authorUser._id.toString(), 'newNotification', notif);
        }
      } catch (notifErr) {
        console.warn('⚠️ [Author Notification Trigger Warning]:', notifErr);
      }
    }

    // If Admin approves the contribution, auto-upsert into MongoDB `trails` collection as well
    if (update.status === 'approved' || updated.status === 'approved') {
      try {
        await TrailModel.findOneAndUpdate(
          { name: updated.name },
          {
            name: updated.name,
            altNames: [],
            region: updated.region || 'Miền Bắc',
            province: updated.province || 'Lào Cai',
            district: updated.district || 'Sa Pa',
            difficultyLevel: updated.difficultyLevel || 3,
            distanceKm: updated.distanceKm || 15,
            elevationGainM: updated.elevationGainM || 800,
            maxAltitudeM: updated.maxAltitudeM || 2000,
            durationDays: Math.ceil((updated.distanceKm || 15) / 10),
            durationHoursNote: updated.durationHoursNote || '1 ngày',
            coverImage: updated.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
            galleryImages: [updated.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'],
            startLocation: {
              type: 'Point',
              coordinates: [updated.startLng || 103.8438, updated.startLat || 22.3364],
            },
            startLat: updated.startLat || 22.3364,
            startLng: updated.startLng || 103.8438,
            endLat: updated.endLat || 22.3512,
            endLng: updated.endLng || 103.864,
            description: updated.description || '',
            transportationInfo: updated.transportationInfo || 'Phương tiện tự túc',
            permitRequired: !!updated.permitRequired,
            permitInfo: updated.permitInfo || '',
            rescueContact: {
              name: 'Hạt Kiểm Lâm ' + (updated.province || 'Địa phương'),
              phone: '114 / SOS 0987-654-321',
              rangerContact: 'Trạm Kiểm Lâm ' + (updated.district || 'Cửa Rừng'),
            },
            rating: 5.0,
            reviewCount: 1,
            hasCampsite: !!updated.hasCampsite,
            hasWaterSource: !!updated.hasWaterSource,
            kidFriendly: !!updated.kidFriendly,
            status: 'approved',
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (trailErr) {
        console.warn('⚠️ [MongoDB Trail Sync Warning]:', trailErr);
      }
    }

    return res.json({ success: true, message: 'Đã cập nhật bài đóng góp trong MongoDB!', data: updated });
  } catch (err) {
    console.error('[Update Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật bài đóng góp.' });
  }
};

// DELETE /api/contributions/:id - Delete a contribution from MongoDB
export const deleteContribution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Contribution.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài đóng góp để xóa.' });
    }

    return res.json({ success: true, message: 'Đã xóa bài đóng góp khỏi MongoDB thành công!' });
  } catch (err) {
    console.error('[Delete Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa bài đóng góp.' });
  }
};
