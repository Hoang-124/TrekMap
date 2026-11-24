import { Request } from 'express';
import mongoose, { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { ActivityModel, IActivity } from '../models/Activity.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const recordAuditLog = async (
  req: Request | AuthRequest,
  action: string,
  targetCollection: string,
  details: string
): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const authUser = (req as AuthRequest).user;
    const userId = authUser?.userId && Types.ObjectId.isValid(authUser.userId)
      ? new Types.ObjectId(authUser.userId)
      : undefined;
    const ipAddress = String(req.ip || req.socket?.remoteAddress || '127.0.0.1').slice(0, 64);
    await AuditLogModel.create({
      userId,
      action: action.slice(0, 120),
      targetCollection: targetCollection.slice(0, 80),
      details: details.slice(0, 500),
      ipAddress,
    });
  } catch (err) {
    console.warn('[AuditLog Write Notice]:', (err as Error).message);
  }
};

export const recordActivity = async (params: {
  userId: string | Types.ObjectId;
  type: IActivity['type'];
  title: string;
  targetType: IActivity['targetType'];
  targetId?: string;
  thumbnailUrl?: string;
}): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const uid = String(params.userId);
    if (!Types.ObjectId.isValid(uid)) return;
    await ActivityModel.create({
      userId: new Types.ObjectId(uid),
      type: params.type,
      title: params.title.slice(0, 200),
      targetType: params.targetType,
      targetId: params.targetId?.slice(0, 80),
      thumbnailUrl: params.thumbnailUrl?.slice(0, 400),
    });
  } catch (err) {
    console.warn('[Activity Write Notice]:', (err as Error).message);
  }
};
