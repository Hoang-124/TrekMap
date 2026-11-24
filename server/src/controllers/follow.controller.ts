import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { FollowModel } from '../models/Follow.js';
import { UserModel } from '../models/User.js';
import { isValidObjectId } from '../utils/resolveTrail.js';
import { sendNotification } from '../utils/notification.js';
import { recordActivity } from '../utils/audit.js';

// POST /api/users/:id/follow - Follow or unfollow a user (sends social notification)
export const toggleFollowUser = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const targetUserId = String(req.params.id || '');

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    if (String(currentUserId) === targetUserId) {
      return res.status(400).json({ success: false, message: 'Không thể tự theo dõi chính mình.' });
    }

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.' });
    }

    const followerObjId = new mongoose.Types.ObjectId(currentUserId);
    const targetObjId = new mongoose.Types.ObjectId(targetUserId);

    const existingFollow = await FollowModel.findOne({
      followerId: followerObjId,
      followingId: targetObjId,
    });

    if (existingFollow) {
      await FollowModel.deleteOne({ _id: existingFollow._id });
      const [newFollowingCount, newFollowersCount] = await Promise.all([
        FollowModel.countDocuments({ followerId: followerObjId }),
        FollowModel.countDocuments({ followingId: targetObjId }),
      ]);
      await Promise.all([
        UserModel.updateOne({ _id: followerObjId }, { $set: { followingCount: newFollowingCount } }).catch(() => {}),
        UserModel.updateOne({ _id: targetObjId }, { $set: { followersCount: newFollowersCount } }).catch(() => {}),
      ]);

      return res.json({ success: true, message: 'Đã bỏ theo dõi.', isFollowing: false, followersCount: newFollowersCount });
    }

    const targetUser = await UserModel.findOne({ _id: targetObjId, isBanned: { $ne: true } })
      .select('_id fullName')
      .lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng để theo dõi.' });
    }

    try {
      await FollowModel.create({
        followerId: followerObjId,
        followingId: targetObjId,
      });
    } catch (createErr: any) {
      if (createErr?.code === 11000) {
        return res.json({ success: true, message: 'Đã theo dõi thành công!', isFollowing: true });
      }
      throw createErr;
    }

    const [newFollowingCount, newFollowersCount, currentUser] = await Promise.all([
      FollowModel.countDocuments({ followerId: followerObjId }),
      FollowModel.countDocuments({ followingId: targetObjId }),
      UserModel.findById(followerObjId).select('fullName username avatarUrl').lean(),
    ]);

    await Promise.all([
      UserModel.updateOne({ _id: followerObjId }, { $set: { followingCount: newFollowingCount } }).catch(() => {}),
      UserModel.updateOne({ _id: targetObjId }, { $set: { followersCount: newFollowersCount } }).catch(() => {}),
    ]);

    if (currentUser) {
      await recordActivity({
        userId: followerObjId,
        type: 'followed_user',
        title: `${currentUser.fullName} đã bắt đầu theo dõi ${targetUser.fullName}`,
        targetType: 'user',
        targetId: String(targetUserId),
      });

      sendNotification({
        recipientId: targetUserId,
        sender: {
          id: currentUserId,
          name: currentUser.fullName || currentUser.username || 'Trekker',
          avatarUrl: currentUser.avatarUrl || '',
        },
        type: 'system',
        category: 'social',
        title: 'Người theo dõi mới',
        message: `${currentUser.fullName || 'Một Trekker'} đã bắt đầu theo dõi hành trình của bạn trên LOST.`,
        link: `/#profile-${currentUser.username || currentUserId}`,
        relatedId: currentUserId,
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Đã theo dõi thành công!',
      isFollowing: true,
      followersCount: newFollowersCount,
    });
  } catch (err) {
    console.error('[Toggle Follow Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật theo dõi.' });
  }
};

// GET /api/users/:id/follow-status - Check if currently following
export const checkFollowStatus = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const targetUserId = String(req.params.id || '');

    if (
      !currentUserId ||
      mongoose.connection.readyState !== 1 ||
      !isValidObjectId(currentUserId) ||
      !isValidObjectId(targetUserId)
    ) {
      return res.json({ success: true, isFollowing: false });
    }

    const follow = await FollowModel.exists({
      followerId: new mongoose.Types.ObjectId(currentUserId),
      followingId: new mongoose.Types.ObjectId(targetUserId),
    });
    return res.json({ success: true, isFollowing: !!follow });
  } catch {
    return res.json({ success: true, isFollowing: false });
  }
};

// Helper to load paginated sanitized follower / following list excluding banned accounts with batched isFollowingByMe
async function loadFollowGraphList(
  req: AuthRequest,
  res: Response,
  direction: 'followers' | 'following'
) {
  const targetUserId = String(req.params.id || '').trim();
  const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 200);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 50);
  const skip = (page - 1) * limit;

  if (!isValidObjectId(targetUserId) || mongoose.connection.readyState !== 1) {
    return res.json({ success: true, count: 0, data: [], pagination: { total: 0, page, limit } });
  }

  const targetObjId = new mongoose.Types.ObjectId(targetUserId);
  const targetUser = await UserModel.findById(targetObjId).select('isBanned').lean();
  if (!targetUser || targetUser.isBanned) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
  }

  const matchField = direction === 'followers' ? 'followingId' : 'followerId';
  const lookupLocalField = direction === 'followers' ? 'followerId' : 'followingId';

  const [facet] = await FollowModel.aggregate([
    { $match: { [matchField]: targetObjId } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: lookupLocalField,
        foreignField: '_id',
        as: 'userDoc',
      },
    },
    { $unwind: '$userDoc' },
    { $match: { 'userDoc.isBanned': { $ne: true } } },
    {
      $facet: {
        total: [{ $count: 'count' }],
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: '$userDoc._id',
              fullName: '$userDoc.fullName',
              username: '$userDoc.username',
              avatarUrl: '$userDoc.avatarUrl',
              reputationScore: { $ifNull: ['$userDoc.reputationScore', 0] },
              role: { $ifNull: ['$userDoc.role', 'user'] },
              badges: { $ifNull: ['$userDoc.badges', []] },
              followedAt: '$createdAt',
            },
          },
        ],
      },
    },
  ]);

  const total = facet?.total?.[0]?.count || 0;
  const rawUsers: any[] = facet?.items || [];

  const viewerId = req.user?.userId;
  const followingSet = new Set<string>();
  if (viewerId && isValidObjectId(viewerId) && rawUsers.length > 0) {
    const viewerObjId = new mongoose.Types.ObjectId(viewerId);
    const targetIds = rawUsers.map((u) => u._id);
    const viewerFollows = await FollowModel.find({
      followerId: viewerObjId,
      followingId: { $in: targetIds },
    })
      .select('followingId')
      .lean();
    for (const vf of viewerFollows) {
      followingSet.add(String(vf.followingId));
    }
  }

  const data = rawUsers.map((u) => {
    const uidStr = String(u._id);
    return {
      _id: uidStr,
      fullName: u.fullName,
      username: u.username,
      avatarUrl: u.avatarUrl || '',
      reputationScore: u.reputationScore,
      role: u.role,
      badges: u.badges,
      isFollowingByMe: followingSet.has(uidStr),
    };
  });

  return res.json({
    success: true,
    count: data.length,
    data,
    pagination: { total, page, limit },
  });
}

// GET /api/users/:id/followers - Paginated public followers list (excludes banned, includes isFollowingByMe)
export const getUserFollowers = async (req: AuthRequest, res: Response) => {
  try {
    return await loadFollowGraphList(req, res, 'followers');
  } catch (err) {
    console.error('[Get Followers Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách người theo dõi.' });
  }
};

// GET /api/users/:id/following - Paginated public following list (excludes banned, includes isFollowingByMe)
export const getUserFollowing = async (req: AuthRequest, res: Response) => {
  try {
    return await loadFollowGraphList(req, res, 'following');
  } catch (err) {
    console.error('[Get Following Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách đang theo dõi.' });
  }
};
