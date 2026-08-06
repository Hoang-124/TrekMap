import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { FollowModel } from '../models/Follow';
import { UserModel } from '../models/User';
import { ActivityModel } from '../models/Activity';

// POST /api/users/:id/follow - Follow or unfollow a user
export const toggleFollowUser = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const targetUserId = req.params.id;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện.' });
    }

    if (currentUserId.toString() === targetUserId) {
      return res.status(400).json({ success: false, message: 'Không thể tự theo dõi chính mình.' });
    }

    const existingFollow = await FollowModel.findOne({
      followerId: currentUserId as any,
      followingId: targetUserId as any,
    });

    if (existingFollow) {
      // Unfollow
      await FollowModel.deleteOne({ _id: existingFollow._id });
      await UserModel.findByIdAndUpdate(currentUserId, { $inc: { followingCount: -1 } }).catch(() => {});
      await UserModel.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } }).catch(() => {});

      return res.json({ success: true, message: 'Đã bỏ theo dõi.', isFollowing: false });
    } else {
      // Follow
      await FollowModel.create({
        followerId: currentUserId as any,
        followingId: targetUserId as any,
      });
      await UserModel.findByIdAndUpdate(currentUserId, { $inc: { followingCount: 1 } }).catch(() => {});
      const targetUser = await UserModel.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });

      // Log activity
      const currentUser = await UserModel.findById(currentUserId);
      if (currentUser && targetUser) {
        await ActivityModel.create({
          userId: currentUserId as any,
          type: 'earned_badge',
          title: `${currentUser.fullName} đã bắt đầu theo dõi ${targetUser.fullName}`,
          targetType: 'badge',
        }).catch(() => {});
      }

      return res.json({ success: true, message: 'Đã theo dõi thành công!', isFollowing: true });
    }
  } catch (err) {
    console.error('[Toggle Follow Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật theo dõi.' });
  }
};

// GET /api/users/:id/follow-status - Check if currently following
export const checkFollowStatus = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const targetUserId = req.params.id;

    if (!currentUserId) {
      return res.json({ success: true, isFollowing: false });
    }

    const follow = await FollowModel.findOne({
      followerId: currentUserId as any,
      followingId: targetUserId as any,
    });
    return res.json({ success: true, isFollowing: !!follow });
  } catch (err) {
    return res.json({ success: true, isFollowing: false });
  }
};
