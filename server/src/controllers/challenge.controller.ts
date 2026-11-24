import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { SummitChallengeModel, ISummitChallenge } from '../models/SummitChallenge.js';
import { ChallengeClaimModel } from '../models/ChallengeClaim.js';
import { CheckinModel } from '../models/Checkin.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { awardReputationPoints } from '../utils/reputation.js';
import { recordActivity } from '../utils/audit.js';
import { sendNotification } from '../utils/notification.js';
import { invalidateCache } from '../middleware/cache.middleware.js';

interface UserConquestSnapshot {
  uniqueTrails: Array<{
    trailObjId: string;
    slug: string;
    name: string;
    region: string;
    province: string;
    distanceKm: number;
    elevationGainM: number;
    maxAltitudeM: number;
    difficultyLevel: number;
    coverImage: string;
    verified: boolean;
    firstCheckinDate: Date;
    lastCheckinDate: Date;
    visitsCount: number;
    bestTimeHours: number;
  }>;
  slugSet: Set<string>;
  verifiedSlugSet: Set<string>;
  totalUniqueKm: number;
  totalUniqueGainM: number;
  highestAltitudeM: number;
  highestPeakName: string;
}

async function buildUserConquestSnapshot(userId: string): Promise<UserConquestSnapshot> {
  const uid = new Types.ObjectId(userId);
  const checkins = await CheckinModel.find({ userId: uid })
    .populate('trailId', 'id name region province distanceKm elevationGainM maxAltitudeM difficultyLevel coverImage')
    .sort({ checkinDate: 1 })
    .lean();

  const map = new Map<string, UserConquestSnapshot['uniqueTrails'][number]>();
  for (const c of checkins as any[]) {
    const t = c.trailId;
    if (!t || !t._id) continue;
    const tid = String(t._id);
    const slug = t.id || tid;
    const existing = map.get(tid);
    if (!existing) {
      map.set(tid, {
        trailObjId: tid,
        slug,
        name: t.name,
        region: t.region || 'Miền Bắc',
        province: t.province || '',
        distanceKm: Number(t.distanceKm) || 0,
        elevationGainM: Number(t.elevationGainM) || 0,
        maxAltitudeM: Number(t.maxAltitudeM) || 0,
        difficultyLevel: Number(t.difficultyLevel) || 3,
        coverImage: t.coverImage || '',
        verified: Boolean(c.verifiedBadge),
        firstCheckinDate: c.checkinDate || c.createdAt,
        lastCheckinDate: c.checkinDate || c.createdAt,
        visitsCount: 1,
        bestTimeHours: Number(c.completionTimeHours) || 0,
      });
    } else {
      existing.visitsCount += 1;
      if (c.verifiedBadge) existing.verified = true;
      const dt = c.checkinDate || c.createdAt;
      if (dt && dt > existing.lastCheckinDate) existing.lastCheckinDate = dt;
      const hrs = Number(c.completionTimeHours);
      if (hrs > 0 && (existing.bestTimeHours === 0 || hrs < existing.bestTimeHours)) {
        existing.bestTimeHours = hrs;
      }
    }
  }

  const uniqueTrails = Array.from(map.values());
  const slugSet = new Set(uniqueTrails.map((t) => t.slug));
  const verifiedSlugSet = new Set(uniqueTrails.filter((t) => t.verified).map((t) => t.slug));

  let totalUniqueKm = 0;
  let totalUniqueGainM = 0;
  let highestAltitudeM = 0;
  let highestPeakName = '';

  for (const t of uniqueTrails) {
    totalUniqueKm += t.distanceKm;
    totalUniqueGainM += t.elevationGainM;
    if (t.maxAltitudeM > highestAltitudeM) {
      highestAltitudeM = t.maxAltitudeM;
      highestPeakName = t.name;
    }
  }

  return {
    uniqueTrails,
    slugSet,
    verifiedSlugSet,
    totalUniqueKm: Math.round(totalUniqueKm * 10) / 10,
    totalUniqueGainM: Math.round(totalUniqueGainM),
    highestAltitudeM,
    highestPeakName,
  };
}

function evaluateChallengeProgress(
  challenge: Pick<
    ISummitChallenge,
    'slug' | 'ruleType' | 'requiredTrailSlugs' | 'minAltitudeM' | 'targetCount' | 'targetKm' | 'targetGainM' | 'region'
  >,
  snapshot: UserConquestSnapshot | null,
  claimedSlugs: Set<string>
) {
  const target =
    challenge.ruleType === 'cumulative_km'
      ? Math.max(1, challenge.targetKm || 100)
      : challenge.ruleType === 'cumulative_gain'
        ? Math.max(100, challenge.targetGainM || 5000)
        : Math.max(1, challenge.targetCount || challenge.requiredTrailSlugs?.length || 1);

  if (!snapshot) {
    return {
      completedTrailSlugs: [] as string[],
      progressValue: 0,
      progressCount: 0,
      targetCount: target,
      progressPercent: 0,
      verifiedCount: 0,
      isCompleted: false,
      isClaimed: false,
    };
  }

  let completedTrailSlugs: string[] = [];
  let progressValue = 0;
  let verifiedCount = 0;

  if (challenge.ruleType === 'trail_slugs') {
    const reqSlugs = Array.isArray(challenge.requiredTrailSlugs) ? challenge.requiredTrailSlugs : [];
    completedTrailSlugs = reqSlugs.filter((s) => snapshot.slugSet.has(s));
    verifiedCount = completedTrailSlugs.filter((s) => snapshot.verifiedSlugSet.has(s)).length;
    progressValue = completedTrailSlugs.length;
  } else if (challenge.ruleType === 'altitude_threshold') {
    const minAlt = challenge.minAltitudeM || 2000;
    const matched = snapshot.uniqueTrails.filter(
      (t) => t.maxAltitudeM >= minAlt && (challenge.region === 'Toàn Quốc' || t.region === challenge.region)
    );
    completedTrailSlugs = matched.map((t) => t.slug);
    verifiedCount = matched.filter((t) => t.verified).length;
    progressValue = matched.length;
  } else if (challenge.ruleType === 'cumulative_km') {
    const matched =
      challenge.region === 'Toàn Quốc'
        ? snapshot.uniqueTrails
        : snapshot.uniqueTrails.filter((t) => t.region === challenge.region);
    completedTrailSlugs = matched.map((t) => t.slug);
    verifiedCount = matched.filter((t) => t.verified).length;
    progressValue = Math.round(matched.reduce((s, t) => s + t.distanceKm, 0) * 10) / 10;
  } else if (challenge.ruleType === 'cumulative_gain') {
    const matched =
      challenge.region === 'Toàn Quốc'
        ? snapshot.uniqueTrails
        : snapshot.uniqueTrails.filter((t) => t.region === challenge.region);
    completedTrailSlugs = matched.map((t) => t.slug);
    verifiedCount = matched.filter((t) => t.verified).length;
    progressValue = Math.round(matched.reduce((s, t) => s + t.elevationGainM, 0));
  }

  const progressPercent = Math.min(100, Math.round((progressValue / target) * 100));
  const isCompleted = progressValue >= target;
  const isClaimed = claimedSlugs.has(challenge.slug);

  return {
    completedTrailSlugs,
    progressValue,
    progressCount: progressValue,
    targetCount: target,
    progressPercent,
    verifiedCount,
    isCompleted,
    isClaimed,
  };
}

function getPassportRank(uniquePeaks: number, highestAltitudeM: number): string {
  if (uniquePeaks >= 12 || (uniquePeaks >= 8 && highestAltitudeM >= 3000)) return 'Huyền Thoại Đỉnh Cao Việt Nam';
  if (uniquePeaks >= 7 || (uniquePeaks >= 5 && highestAltitudeM >= 2800)) return 'Đại Sư Săn Đỉnh (Alpine Master)';
  if (uniquePeaks >= 4 || highestAltitudeM >= 2800) return 'Chinh Phục Hoàng Liên';
  if (uniquePeaks >= 2) return 'Nhà Thám Hiểm Rừng Núi';
  if (uniquePeaks >= 1) return 'Người Mở Lối';
  return 'Tân Binh Trekking';
}

// GET /api/challenges - List active Vietnam Summit Challenges + real user progress when authenticated
export const getChallenges = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const filter: any = { isActive: true };
    if (typeof req.query.region === 'string' && req.query.region !== 'All' && req.query.region.trim()) {
      filter.region = req.query.region.trim();
    }
    if (typeof req.query.tier === 'string' && req.query.tier.trim()) {
      filter.tier = req.query.tier.trim();
    }

    const challenges = await SummitChallengeModel.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();

    let snapshot: UserConquestSnapshot | null = null;
    const claimedSlugs = new Set<string>();

    if (req.user?.userId && Types.ObjectId.isValid(req.user.userId)) {
      const [snap, claims] = await Promise.all([
        buildUserConquestSnapshot(req.user.userId),
        ChallengeClaimModel.find({ userId: new Types.ObjectId(req.user.userId) }).select('challengeSlug').lean(),
      ]);
      snapshot = snap;
      claims.forEach((c) => claimedSlugs.add(c.challengeSlug));
    }

    // Batch-resolve claim counts per challenge
    const claimCountsAgg = await ChallengeClaimModel.aggregate([
      { $group: { _id: '$challengeSlug', completersCount: { $sum: 1 } } },
    ]);
    const completersMap = new Map<string, number>();
    claimCountsAgg.forEach((row: any) => completersMap.set(String(row._id), row.completersCount));

    const data = challenges.map((ch) => ({
      ...ch,
      completersCount: completersMap.get(ch.slug) || 0,
      progress: evaluateChallengeProgress(ch, snapshot, claimedSlugs),
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[Get Challenges Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách thử thách chinh phục đỉnh.' });
  }
};

// GET /api/challenges/passport/me - Full Personal Peak Passport with stamped peaks, altitude bands & regional stats
export const getMyPeakPassport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xem Hộ Chiếu Đỉnh Cao.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const [snapshot, allApprovedTrails, challenges, claims, user] = await Promise.all([
      buildUserConquestSnapshot(userId),
      TrailModel.find({ status: 'approved' }).select('id name region maxAltitudeM').lean(),
      SummitChallengeModel.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
      ChallengeClaimModel.find({ userId: uid }).sort({ claimedAt: -1 }).lean(),
      UserModel.findById(uid).select('fullName username avatarUrl reputationScore badges createdAt').lean(),
    ]);

    const claimedSlugs = new Set(claims.map((c) => c.challengeSlug));

    const regionTotals: Record<string, { total: number; conquered: number }> = {
      'Miền Bắc': { total: 0, conquered: 0 },
      'Miền Trung': { total: 0, conquered: 0 },
      'Miền Nam': { total: 0, conquered: 0 },
    };
    for (const t of allApprovedTrails) {
      if (regionTotals[t.region]) regionTotals[t.region].total += 1;
    }
    for (const st of snapshot.uniqueTrails) {
      if (regionTotals[st.region]) regionTotals[st.region].conquered += 1;
    }

    const altitudeBands = [
      { label: 'Dưới 1.000m', minM: 0, maxM: 999, count: 0 },
      { label: '1.000m – 1.999m', minM: 1000, maxM: 1999, count: 0 },
      { label: '2.000m – 2.799m', minM: 2000, maxM: 2799, count: 0 },
      { label: 'Trên 2.800m (Đỉnh Cao)', minM: 2800, maxM: 9999, count: 0 },
    ];
    for (const st of snapshot.uniqueTrails) {
      const band = altitudeBands.find((b) => st.maxAltitudeM >= b.minM && st.maxAltitudeM <= b.maxM);
      if (band) band.count += 1;
    }

    const verifiedCount = snapshot.uniqueTrails.filter((t) => t.verified).length;
    const challengeSummaries = challenges.map((ch) => ({
      slug: ch.slug,
      title: ch.title,
      badgeName: ch.badgeName,
      tier: ch.tier,
      region: ch.region,
      rewardPoints: ch.rewardPoints,
      progress: evaluateChallengeProgress(ch, snapshot, claimedSlugs),
    }));

    return res.json({
      success: true,
      data: {
        passportHolder: {
          userId,
          fullName: user?.fullName || 'Trekker',
          username: user?.username || '',
          avatarUrl: user?.avatarUrl || '',
          memberSince: user?.createdAt,
          reputationScore: user?.reputationScore || 0,
          badges: user?.badges || [],
          rankTitle: getPassportRank(snapshot.uniqueTrails.length, snapshot.highestAltitudeM),
        },
        summary: {
          totalStampedPeaks: snapshot.uniqueTrails.length,
          totalAvailableTrails: allApprovedTrails.length,
          conquestPercent:
            allApprovedTrails.length > 0
              ? Math.min(100, Math.round((snapshot.uniqueTrails.length / allApprovedTrails.length) * 100))
              : 0,
          verifiedGpsPeaks: verifiedCount,
          verifiedRatioPercent:
            snapshot.uniqueTrails.length > 0 ? Math.round((verifiedCount / snapshot.uniqueTrails.length) * 100) : 0,
          totalUniqueKm: snapshot.totalUniqueKm,
          totalUniqueGainM: snapshot.totalUniqueGainM,
          highestAltitudeM: snapshot.highestAltitudeM,
          highestPeakName: snapshot.highestPeakName || 'Chưa ghi nhận',
          claimedChallengesCount: claims.length,
          readyToClaimCount: challengeSummaries.filter((c) => c.progress.isCompleted && !c.progress.isClaimed).length,
        },
        regions: Object.entries(regionTotals).map(([region, stats]) => ({
          region,
          conquered: stats.conquered,
          total: stats.total,
          percent: stats.total > 0 ? Math.min(100, Math.round((stats.conquered / stats.total) * 100)) : 0,
        })),
        altitudeBands,
        stampedPeaks: snapshot.uniqueTrails.sort((a, b) => b.maxAltitudeM - a.maxAltitudeM),
        challenges: challengeSummaries,
        claims,
      },
    });
  } catch (err) {
    console.error('[Get Peak Passport Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải Hộ Chiếu Đỉnh Cao.' });
  }
};

// GET /api/challenges/leaderboard - Deduplicated Vietnam Summit Leaderboard (filterable by region)
export const getChallengeLeaderboard = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 50);
    const region = typeof req.query.region === 'string' && req.query.region !== 'All' ? req.query.region.trim() : '';

    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const pipeline: any[] = [
      {
        $group: {
          _id: { userId: '$userId', trailId: '$trailId' },
          anyVerified: { $max: { $cond: ['$verifiedBadge', 1, 0] } },
          lastCheckinAt: { $max: '$checkinDate' },
        },
      },
      {
        $lookup: {
          from: 'trails',
          localField: '_id.trailId',
          foreignField: '_id',
          as: 'trail',
        },
      },
      { $unwind: '$trail' },
    ];

    if (region && ['Miền Bắc', 'Miền Trung', 'Miền Nam'].includes(region)) {
      pipeline.push({ $match: { 'trail.region': region } });
    }

    pipeline.push(
      {
        $group: {
          _id: '$_id.userId',
          trailsConquered: { $sum: 1 },
          verifiedPeaks: { $sum: '$anyVerified' },
          totalUniqueKm: { $sum: { $ifNull: ['$trail.distanceKm', 0] } },
          totalElevationGainM: { $sum: { $ifNull: ['$trail.elevationGainM', 0] } },
          highestAltitudeM: { $max: { $ifNull: ['$trail.maxAltitudeM', 0] } },
          lastCheckinAt: { $max: '$lastCheckinAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.isBanned': { $ne: true } } },
      {
        $lookup: {
          from: 'challengeclaims',
          localField: '_id',
          foreignField: 'userId',
          as: 'claims',
        },
      },
      {
        $project: {
          userId: { $toString: '$_id' },
          fullName: '$user.fullName',
          username: '$user.username',
          avatarUrl: '$user.avatarUrl',
          reputationScore: { $ifNull: ['$user.reputationScore', 0] },
          badgesCount: { $size: { $ifNull: ['$user.badges', []] } },
          claimedChallengesCount: { $size: '$claims' },
          trailsConquered: 1,
          verifiedPeaks: 1,
          totalUniqueKm: { $round: ['$totalUniqueKm', 1] },
          totalElevationGainM: { $round: ['$totalElevationGainM', 0] },
          highestAltitudeM: 1,
          lastCheckinAt: 1,
        },
      },
      { $sort: { trailsConquered: -1, highestAltitudeM: -1, totalUniqueKm: -1, reputationScore: -1 } },
      { $limit: limit }
    );

    const rows = await CheckinModel.aggregate(pipeline);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[Challenge Leaderboard Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải bảng xếp hạng chinh phục đỉnh.' });
  }
};

// GET /api/challenges/:slug - Single challenge detail with resolved required trail cards & completers
export const getChallengeBySlug = async (req: AuthRequest, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Thiếu mã thử thách.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const challenge = await SummitChallengeModel.findOne({ slug, isActive: true }).lean();
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thử thách này.' });
    }

    const trailQuery: any = { status: 'approved' };
    if (challenge.ruleType === 'trail_slugs' && challenge.requiredTrailSlugs.length > 0) {
      trailQuery.id = { $in: challenge.requiredTrailSlugs };
    } else if (challenge.ruleType === 'altitude_threshold') {
      trailQuery.maxAltitudeM = { $gte: challenge.minAltitudeM || 2000 };
      if (challenge.region !== 'Toàn Quốc') trailQuery.region = challenge.region;
    } else if (challenge.region !== 'Toàn Quốc') {
      trailQuery.region = challenge.region;
    }

    const [trails, recentCompleters] = await Promise.all([
      TrailModel.find(trailQuery)
        .select('id name province region maxAltitudeM distanceKm elevationGainM difficultyLevel coverImage')
        .sort({ maxAltitudeM: -1 })
        .limit(30)
        .lean(),
      ChallengeClaimModel.find({ challengeSlug: challenge.slug })
        .populate('userId', 'fullName username avatarUrl reputationScore isBanned')
        .sort({ claimedAt: -1 })
        .limit(12)
        .lean(),
    ]);

    let snapshot: UserConquestSnapshot | null = null;
    const claimedSlugs = new Set<string>();
    if (req.user?.userId && Types.ObjectId.isValid(req.user.userId)) {
      const [snap, claim] = await Promise.all([
        buildUserConquestSnapshot(req.user.userId),
        ChallengeClaimModel.exists({ userId: new Types.ObjectId(req.user.userId), challengeSlug: challenge.slug }),
      ]);
      snapshot = snap;
      if (claim) claimedSlugs.add(challenge.slug);
    }

    const progress = evaluateChallengeProgress(challenge, snapshot, claimedSlugs);

    return res.json({
      success: true,
      data: {
        ...challenge,
        progress,
        trails: trails.map((t) => ({
          ...t,
          completedByUser: snapshot ? snapshot.slugSet.has(t.id || String(t._id)) : false,
          verifiedByGps: snapshot ? snapshot.verifiedSlugSet.has(t.id || String(t._id)) : false,
        })),
        recentCompleters: recentCompleters
          .filter((c: any) => c.userId && !c.userId.isBanned)
          .map((c: any) => ({
            userId: String(c.userId._id),
            fullName: c.userId.fullName,
            username: c.userId.username,
            avatarUrl: c.userId.avatarUrl,
            claimedAt: c.claimedAt,
          })),
      },
    });
  } catch (err) {
    console.error('[Get Challenge Detail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết thử thách.' });
  }
};

// POST /api/challenges/:slug/claim - Server-verified atomic idempotent badge + reputation reward claim
export const claimChallengeReward = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để nhận huy hiệu thử thách.' });
    }
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Thiếu mã thử thách.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const challenge = await SummitChallengeModel.findOne({ slug, isActive: true }).lean();
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thử thách này.' });
    }

    const uid = new Types.ObjectId(userId);
    const snapshot = await buildUserConquestSnapshot(userId);
    const alreadyClaimed = await ChallengeClaimModel.exists({ userId: uid, challengeSlug: slug });
    if (alreadyClaimed) {
      return res.status(409).json({
        success: false,
        message: `Bạn đã nhận huy hiệu "${challenge.badgeName}" cho thử thách này rồi!`,
      });
    }

    const progress = evaluateChallengeProgress(challenge, snapshot, new Set());
    if (!progress.isCompleted) {
      return res.status(400).json({
        success: false,
        message: `Bạn mới hoàn thành ${progress.progressValue}/${progress.targetCount} (${progress.progressPercent}%) thử thách "${challenge.title}". Hãy check-in thêm cung đường để mở khóa!`,
        progress,
      });
    }

    // Atomic unique insert prevents concurrent double-claims
    let claim;
    try {
      claim = await ChallengeClaimModel.create({
        userId: uid,
        challengeSlug: slug,
        badgeName: challenge.badgeName,
        pointsAwarded: challenge.rewardPoints,
        claimedAt: new Date(),
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'Bạn đã nhận phần thưởng thử thách này rồi.' });
      }
      throw err;
    }

    await UserModel.updateOne({ _id: uid }, { $addToSet: { badges: challenge.badgeName } });
    const reputationReward = await awardReputationPoints(
      userId,
      challenge.rewardPoints,
      `Hoàn thành thử thách "${challenge.title}"`
    );

    await recordActivity({
      userId: uid,
      type: 'earned_badge',
      title: `Hoàn thành thử thách "${challenge.title}" & mở khóa huy hiệu "${challenge.badgeName}"`,
      targetType: 'badge',
      targetId: challenge.badgeName,
      thumbnailUrl: challenge.coverImage,
    });

    sendNotification({
      recipientId: userId,
      type: 'badge_earned',
      category: 'system',
      title: `Mở khóa huy hiệu: ${challenge.badgeName}`,
      message: `Chúc mừng bạn đã hoàn thành thử thách "${challenge.title}" và nhận +${challenge.rewardPoints} điểm uy tín!`,
      link: '/passport',
      relatedId: challenge.slug,
    }).catch(() => {});

    invalidateCache('/api/challenges/leaderboard');

    return res.status(201).json({
      success: true,
      message: `Chúc mừng! Bạn đã nhận huy hiệu "${challenge.badgeName}" (+${challenge.rewardPoints} điểm uy tín)!`,
      data: {
        claim,
        badgeName: challenge.badgeName,
        pointsAwarded: challenge.rewardPoints,
        reputationReward,
      },
    });
  } catch (err) {
    console.error('[Claim Challenge Reward Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi nhận huy hiệu thử thách.' });
  }
};
