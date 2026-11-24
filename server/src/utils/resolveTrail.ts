import mongoose from 'mongoose';
import { TrailModel, ITrail } from '../models/Trail.js';

export function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value) && /^[a-fA-F0-9]{24}$/.test(value);
}

/**
 * Resolves a trail document by either MongoDB ObjectId (`_id`) or canonical slug (`id`, e.g. 'trail-fansipan').
 * Never passes non-ObjectId strings into `_id` queries, preventing Mongoose CastErrors.
 */
export async function resolveTrailByIdOrSlug(idOrSlug: unknown): Promise<ITrail | null> {
  if (typeof idOrSlug !== 'string' || !idOrSlug.trim()) return null;
  const trimmed = idOrSlug.trim();

  if (mongoose.connection.readyState !== 1) return null;

  if (isValidObjectId(trimmed)) {
    const byObjectId = await TrailModel.findById(trimmed);
    if (byObjectId) return byObjectId;
  }

  return TrailModel.findOne({ id: trimmed });
}

export async function resolveTrailObjectId(idOrSlug: unknown): Promise<mongoose.Types.ObjectId | null> {
  if (typeof idOrSlug !== 'string' || !idOrSlug.trim()) return null;
  const trimmed = idOrSlug.trim();

  if (mongoose.connection.readyState === 1) {
    const trail = await resolveTrailByIdOrSlug(trimmed);
    if (trail?._id) {
      return trail._id as mongoose.Types.ObjectId;
    }
  }

  if (isValidObjectId(trimmed)) {
    return new mongoose.Types.ObjectId(trimmed);
  }

  return null;
}
