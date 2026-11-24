import { UserModel } from '../models/User.js';

export interface ReputationRewardResult {
  previousScore: number;
  newScore: number;
  pointsAwarded: number;
  action: string;
  newBadgesEarned: string[];
  totalBadges: string[];
}

export const REPUTATION_POINTS = {
  CONTRIBUTE_TRAIL: 50,
  CONTRIBUTE_REVIEW: 20,
  CREATE_FORUM_THREAD: 15,
  CREATE_COMMENT: 10,
  VERIFY_EMAIL: 30,
};

export const PENALTY_POINTS = {
  PROFANITY_VIOLATION: 20,
  TOXIC_COMMENT: 10,
  FALSE_SOS_REPORT: 100,
  DELETED_POST: 30,
};

const SCORE_TIER_BADGES: Array<{ minScore: number; name: string }> = [
  { minScore: 100, name: 'Người Khai Phá' },
  { minScore: 200, name: 'Trekker Kỳ Cựu' },
  { minScore: 500, name: 'Chuyên Gia Núi Rừng' },
];

export function calculateBadgesForScore(
  score: number,
  existingBadges: string[] = [],
  isVerifiedAccount = false
): string[] {
  const badgeSet = new Set<string>(existingBadges);

  badgeSet.add('Trekker Mới');
  // Preserve Verified Trekker for verified accounts regardless of reputation dips
  if (score >= 50 || isVerifiedAccount) {
    badgeSet.add('Verified Trekker');
  } else {
    badgeSet.delete('Verified Trekker');
  }

  for (const tier of SCORE_TIER_BADGES) {
    if (score >= tier.minScore) badgeSet.add(tier.name);
    else badgeSet.delete(tier.name);
  }

  return Array.from(badgeSet);
}

export function getReputationTierTitle(score: number): string {
  if (score >= 500) return 'Chuyên Gia Núi Rừng';
  if (score >= 200) return 'Trekker Kỳ Cựu';
  if (score >= 100) return 'Người Khai Phá';
  if (score >= 50) return 'Verified Trekker';
  return 'Trekker Tập Sự';
}

export async function awardReputationPoints(
  userId: string,
  points: number,
  actionDescription: string
): Promise<ReputationRewardResult | null> {
  if (!userId || !Number.isFinite(points) || points <= 0) return null;

  try {
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { reputationScore: points } },
      { new: true }
    )
      .select('reputationScore badges isEmailVerified authProvider')
      .lean();

    if (!updatedUser) return null;

    const newScore = Math.max(0, updatedUser.reputationScore || 0);
    const previousScore = Math.max(0, newScore - points);
    const previousBadges = updatedUser.badges || [];
    const isVerified = Boolean(updatedUser.isEmailVerified || updatedUser.authProvider === 'google');

    const badgesToAdd: string[] = [];
    if (!previousBadges.includes('Trekker Mới')) badgesToAdd.push('Trekker Mới');
    if ((newScore >= 50 || isVerified) && !previousBadges.includes('Verified Trekker')) {
      badgesToAdd.push('Verified Trekker');
    }
    for (const tier of SCORE_TIER_BADGES) {
      if (newScore >= tier.minScore && !previousBadges.includes(tier.name)) {
        badgesToAdd.push(tier.name);
      }
    }

    // Atomic $addToSet prevents concurrent badge updates from clobbering custom badges
    if (badgesToAdd.length > 0) {
      await UserModel.updateOne({ _id: userId }, { $addToSet: { badges: { $each: badgesToAdd } } });
    }

    const totalBadges = Array.from(new Set([...previousBadges, ...badgesToAdd]));

    return {
      previousScore,
      newScore,
      pointsAwarded: points,
      action: actionDescription,
      newBadgesEarned: badgesToAdd,
      totalBadges,
    };
  } catch (err) {
    console.error('[Reputation Engine Notice]:', (err as Error).message);
    return null;
  }
}

export async function deductReputationPoints(
  userId: string,
  penaltyPoints: number,
  violationReason: string
): Promise<ReputationRewardResult | null> {
  if (!userId || !Number.isFinite(penaltyPoints) || penaltyPoints <= 0) return null;

  try {
    // Atomic floor-clamped deduction via aggregation pipeline update (MongoDB 4.2+)
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      [
        {
          $set: {
            reputationScore: {
              $max: [0, { $subtract: [{ $ifNull: ['$reputationScore', 0] }, penaltyPoints] }],
            },
          },
        },
      ],
      { new: true }
    )
      .select('reputationScore badges isEmailVerified authProvider')
      .lean();

    if (!updatedUser) return null;

    const newScore = Math.max(0, updatedUser.reputationScore || 0);
    const previousScore = newScore + penaltyPoints;
    const previousBadges = updatedUser.badges || [];
    const isVerified = Boolean(updatedUser.isEmailVerified || updatedUser.authProvider === 'google');

    const badgesToRemove: string[] = [];
    if (!isVerified && newScore < 50 && previousBadges.includes('Verified Trekker')) {
      badgesToRemove.push('Verified Trekker');
    }
    for (const tier of SCORE_TIER_BADGES) {
      if (newScore < tier.minScore && previousBadges.includes(tier.name)) {
        badgesToRemove.push(tier.name);
      }
    }

    if (badgesToRemove.length > 0) {
      await UserModel.updateOne({ _id: userId }, { $pull: { badges: { $in: badgesToRemove } } });
    }

    const totalBadges = previousBadges.filter((b) => !badgesToRemove.includes(b));

    return {
      previousScore,
      newScore,
      pointsAwarded: -penaltyPoints,
      action: `Hình phạt: ${violationReason}`,
      newBadgesEarned: [],
      totalBadges,
    };
  } catch (err) {
    console.error('[Reputation Penalty Error]:', (err as Error).message);
    return null;
  }
}
