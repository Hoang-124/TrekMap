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

/**
 * Calculates badge list according to reputation score progression
 */
export function calculateBadgesForScore(score: number, existingBadges: string[] = []): string[] {
  const badgeSet = new Set<string>(existingBadges);
  
  if (!badgeSet.has('Trekker Mới')) badgeSet.add('Trekker Mới');
  if (score >= 50 && !badgeSet.has('Verified Trekker')) badgeSet.add('Verified Trekker');
  if (score >= 100 && !badgeSet.has('Người Khai Phá')) badgeSet.add('Người Khai Phá');
  if (score >= 200 && !badgeSet.has('Trekker Kỳ Cựu')) badgeSet.add('Trekker Kỳ Cựu');
  if (score >= 500 && !badgeSet.has('Chuyên Gia Núi Rừng')) badgeSet.add('Chuyên Gia Núi Rừng');
  
  // Demote higher rank badges if score drops below threshold
  if (score < 500) badgeSet.delete('Chuyên Gia Núi Rừng');
  if (score < 200) badgeSet.delete('Trekker Kỳ Cựu');
  if (score < 100) badgeSet.delete('Người Khai Phá');
  if (score < 50) badgeSet.delete('Verified Trekker');

  return Array.from(badgeSet);
}

/**
 * Returns human-readable reputation tier title
 */
export function getReputationTierTitle(score: number): string {
  if (score >= 500) return 'Chuyên Gia Núi Rừng';
  if (score >= 200) return 'Trekker Kỳ Cựu';
  if (score >= 100) return 'Người Khai Phá';
  if (score >= 50) return 'Verified Trekker';
  return 'Trekker Tập Sự';
}

/**
 * Centralized reputation reward engine for TrekMap
 */
export async function awardReputationPoints(
  userId: string,
  points: number,
  actionDescription: string
): Promise<ReputationRewardResult | null> {
  if (!userId) return null;

  try {
    const user = await UserModel.findById(userId).exec();
    if (!user) return null;

    const previousScore = user.reputationScore || 0;
    const newScore = previousScore + points;
    const previousBadges = user.badges || [];
    const updatedBadges = calculateBadgesForScore(newScore, previousBadges);

    const newBadgesEarned = updatedBadges.filter((b) => !previousBadges.includes(b));

    user.reputationScore = newScore;
    user.badges = updatedBadges;
    await user.save();

    return {
      previousScore,
      newScore,
      pointsAwarded: points,
      action: actionDescription,
      newBadgesEarned,
      totalBadges: updatedBadges,
    };
  } catch (err) {
    console.error('⚠️ [Reputation Engine Notice]:', (err as Error).message);
    return null;
  }
}

/**
 * Deducts reputation points for violations (profanity, false reports, spam)
 */
export async function deductReputationPoints(
  userId: string,
  penaltyPoints: number,
  violationReason: string
): Promise<ReputationRewardResult | null> {
  if (!userId) return null;

  try {
    const user = await UserModel.findById(userId).exec();
    if (!user) return null;

    const previousScore = user.reputationScore || 0;
    // Ensure reputation score floor does not drop below 0
    const newScore = Math.max(0, previousScore - penaltyPoints);
    const previousBadges = user.badges || [];
    const updatedBadges = calculateBadgesForScore(newScore, previousBadges);

    user.reputationScore = newScore;
    user.badges = updatedBadges;
    await user.save();

    return {
      previousScore,
      newScore,
      pointsAwarded: -penaltyPoints,
      action: `Hình phạt: ${violationReason}`,
      newBadgesEarned: [],
      totalBadges: updatedBadges,
    };
  } catch (err) {
    console.error('⚠️ [Reputation Penalty Error]:', (err as Error).message);
    return null;
  }
}
