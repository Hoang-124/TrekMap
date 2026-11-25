import crypto from 'crypto';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { GuideModel } from '../models/Guide.js';
import { GuideInquiryModel } from '../models/GuideInquiry.js';
import { IncidentModel } from '../models/Incident.js';
import { CategoryModel } from '../models/Category.js';
import { ReviewModel } from '../models/Review.js';
import { ThreadModel } from '../models/Thread.js';
import { WeatherForecastModel } from '../models/WeatherForecast.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { AiKnowledgeModel } from '../models/AiKnowledge.js';
import { SummitChallengeModel } from '../models/SummitChallenge.js';
import { RangerStationModel } from '../models/RangerStation.js';
import { mockTrails } from '../data/seedData.js';
import {
  VIETNAM_SUMMIT_CHALLENGES,
  VIETNAM_RANGER_STATIONS,
  VERIFIED_GUIDES_EXTENDED,
} from '../data/vietnamDirectory.js';
import { masterKnowledgeDataset, removeVietnameseDiacritics } from '../data/trekkerKnowledgeDataset.js';
import { hashPassword } from './auth.js';

export const seedAll13Collections = async (): Promise<boolean> => {
  try {
    const forceSync =
      process.env.FORCE_SEED_SYNC === 'true' || process.env.SEED_FORCE_SYNC === 'true';
    console.log(
      `[MongoDB Seeder]: Initializing ${forceSync ? 'FORCE-SYNC' : 'non-destructive ($setOnInsert)'} MongoDB seeding...`
    );

    // 1. Seed Categories (idempotent)
    const categoriesCount = await CategoryModel.countDocuments();
    if (categoriesCount === 0) {
      await CategoryModel.insertMany([
        { name: 'Kinh Nghiệm', slug: 'kinh-nghiem', description: 'Chia sẻ kinh nghiệm trekking thực tế', icon: 'Compass' },
        { name: 'Hỏi Đáp', slug: 'hoi-dap', description: 'Góc giải đáp thắc mắc cung đường', icon: 'HelpCircle' },
        { name: 'Tìm Đồng Đội', slug: 'tim-dong-doi', description: 'Lập nhóm ghép đoàn leo núi', icon: 'Users' },
        { name: 'Cảnh Báo', slug: 'canh-bao', description: 'Thông tin thời tiết và cứu hộ khẩn cấp', icon: 'AlertTriangle' },
      ]);
    }

    // 2. Seed Admin User (idempotent, requires ADMIN_SEED_PASSWORD in production)
    let adminUser = await UserModel.findOne({
      $or: [{ email: 'hoang@lost.vn' }, { username: 'hoangtrekker' }],
    });
    if (!adminUser) {
      const seedPassword = process.env.ADMIN_SEED_PASSWORD;
      if (process.env.NODE_ENV === 'production' && !seedPassword) {
        console.warn('[MongoDB Seeder]: Skipping default admin seed in production (ADMIN_SEED_PASSWORD not set).');
      } else {
        const finalPassword = seedPassword || 'Admin@LOST2026!';
        adminUser = await UserModel.create({
          username: 'hoangtrekker',
          email: 'hoang@lost.vn',
          passwordHash: hashPassword(finalPassword),
          fullName: 'Hoàng Trekker (Verified Guide)',
          avatarUrl: '/covers/avatar-admin.svg',
          role: 'admin',
          authProvider: 'local',
          isEmailVerified: true,
          reputationScore: 1250,
          badges: ['Top Contributor', 'Verified Guide', 'Fansipan Summitter'],
        });
      }
    }

    // 3. Idempotent GuideModel Upsert + Legacy Placeholder Cleanup (9 Verified Official National Park / Reserve Channels)
    // - Retires the 3 legacy pre-Rule-11 fabricated mock guides (fake sequential phones 0912888999 / 0978987654 / 0912345678)
    //   without touching any real admin-added guides; preserves docs if user reviews or inquiries ever reference them.
    // - Matches canonical guides by slug, exact name, OR normalized phone digits so punctuation differences never duplicate,
    //   merges reviews/inquiries if duplicates exist, and NEVER overwrites live user ratings/reviews.
    const normalizePhoneDigits = (phone?: string): string => (phone || '').replace(/\D/g, '');
    const canonicalGuideSlugs = new Set(VERIFIED_GUIDES_EXTENDED.map((g) => g.slug));
    const LEGACY_FABRICATED_GUIDE_NAMES = new Set([
      'Anh Chảo A Sải (Trạm Tôn / Fansipan Guide)',
      'A Páo (Tà Xùa / Y Tý Expert)',
      'Anh Hùng (Guide Tà Năng - Phan Dũng)',
    ]);
    const LEGACY_FABRICATED_GUIDE_PHONES = new Set(['0912888999', '0978987654', '0912345678']);

    const existingGuidesSnapshot = await GuideModel.find({}).lean();
    for (const doc of existingGuidesSnapshot) {
      const hasCanonicalSlug = Boolean(doc.slug && canonicalGuideSlugs.has(doc.slug));
      if (hasCanonicalSlug) continue;
      const phoneDigits = normalizePhoneDigits(doc.phone);
      const isLegacyMock =
        LEGACY_FABRICATED_GUIDE_NAMES.has(doc.name) || LEGACY_FABRICATED_GUIDE_PHONES.has(phoneDigits);
      if (!isLegacyMock) continue;

      const hasUserReviews = Array.isArray(doc.reviews) && doc.reviews.length > 0;
      const hasInquiries = Boolean(await GuideInquiryModel.exists({ guideId: doc._id }));
      if (hasUserReviews || hasInquiries) {
        await GuideModel.updateOne({ _id: doc._id }, { $set: { isActive: false, verified: false } });
      } else {
        await GuideModel.deleteOne({ _id: doc._id });
      }
    }

    const activeGuidesAfterCleanup = await GuideModel.find({}).lean();
    for (const g of VERIFIED_GUIDES_EXTENDED) {
      const targetDigits = normalizePhoneDigits(g.phone);
      const matches = activeGuidesAfterCleanup.filter(
        (doc) =>
          (doc.slug && doc.slug === g.slug) ||
          doc.name === g.name ||
          (targetDigits.length >= 8 && normalizePhoneDigits(doc.phone) === targetDigits)
      );

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const aSlug = a.slug === g.slug ? 1 : 0;
          const bSlug = b.slug === g.slug ? 1 : 0;
          if (aSlug !== bSlug) return bSlug - aSlug;
          const aReviews = Array.isArray(a.reviews) ? a.reviews.length : 0;
          const bReviews = Array.isArray(b.reviews) ? b.reviews.length : 0;
          if (aReviews !== bReviews) return bReviews - aReviews;
          return String(a._id).localeCompare(String(b._id));
        });

        const primary = matches[0];
        const duplicates = matches.slice(1);
        const primaryReviews = Array.isArray(primary.reviews) ? [...primary.reviews] : [];
        let reviewsMerged = false;

        for (const dup of duplicates) {
          if (Array.isArray(dup.reviews) && dup.reviews.length > 0) {
            for (const rev of dup.reviews) {
              const alreadyExists = primaryReviews.some(
                (r) => String(r.userId) === String(rev.userId) && r.comment === rev.comment
              );
              if (!alreadyExists) {
                primaryReviews.push(rev);
                reviewsMerged = true;
              }
            }
          }
          await GuideInquiryModel.updateMany({ guideId: dup._id }, { $set: { guideId: primary._id } });
          await GuideModel.deleteOne({ _id: dup._id });
        }

        if (forceSync) {
          const updateFields: Record<string, unknown> = {
            slug: g.slug,
            name: g.name,
            phone: g.phone,
            avatarUrl: g.avatarUrl,
            roleType: g.roleType,
            region: g.region,
            provinces: g.provinces,
            trailSlugs: g.trailSlugs,
            priceNote: g.priceNote,
            basePricePerDayVnd: g.basePricePerDayVnd,
            maxGroupSize: g.maxGroupSize,
            specialties: g.specialties,
            languages: g.languages,
            certifications: g.certifications,
            experienceYears: g.experienceYears,
            bio: g.bio,
            verified: g.verified,
            isActive: g.isActive,
          };

          if (reviewsMerged) {
            const avgRating =
              primaryReviews.length > 0
                ? Math.round(
                    (primaryReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / primaryReviews.length) * 10
                  ) / 10
                : 0;
            updateFields.reviews = primaryReviews;
            updateFields.reviewCount = primaryReviews.length;
            updateFields.rating = avgRating;
          }

          await GuideModel.updateOne({ _id: primary._id }, { $set: updateFields });
        } else if (reviewsMerged || !primary.slug) {
          const nonDestructivePatch: Record<string, unknown> = {};
          if (!primary.slug) nonDestructivePatch.slug = g.slug;
          if (reviewsMerged) {
            const avgRating =
              primaryReviews.length > 0
                ? Math.round(
                    (primaryReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / primaryReviews.length) * 10
                  ) / 10
                : 0;
            nonDestructivePatch.reviews = primaryReviews;
            nonDestructivePatch.reviewCount = primaryReviews.length;
            nonDestructivePatch.rating = avgRating;
          }
          await GuideModel.updateOne({ _id: primary._id }, { $set: nonDestructivePatch });
        }
      } else {
        await GuideModel.create({
          slug: g.slug,
          name: g.name,
          phone: g.phone,
          avatarUrl: g.avatarUrl,
          roleType: g.roleType,
          region: g.region,
          provinces: g.provinces,
          trailSlugs: g.trailSlugs,
          priceNote: g.priceNote,
          basePricePerDayVnd: g.basePricePerDayVnd,
          maxGroupSize: g.maxGroupSize,
          specialties: g.specialties,
          languages: g.languages,
          certifications: g.certifications,
          experienceYears: g.experienceYears,
          bio: g.bio,
          verified: g.verified,
          isActive: g.isActive,
          rating: g.rating,
          reviewCount: g.reviewCount,
        });
      }
    }

    const totalGuides = await GuideModel.countDocuments({ isActive: { $ne: false } });
    console.log(`[MongoDB Seeder]: Verified ${totalGuides} active official Guides in 'guides' collection.`);

    // 4. Strictly Non-Destructive Trail Seeding ($setOnInsert only by default — preserves Admin edits!)
    // Explicit overwrite sync ONLY when FORCE_SEED_SYNC=true is set for CLI maintenance.
    for (const t of mockTrails) {
      const canonicalGeoAndMeta = {
        startLat: t.startLat,
        startLng: t.startLng,
        endLat: t.endLat,
        endLng: t.endLng,
        startLocation: {
          type: 'Point' as const,
          coordinates: [t.startLng, t.startLat] as [number, number],
        },
        waypoints: t.waypoints,
        gpxTrack: t.gpxTrack,
        coverImage: t.coverImage,
        galleryImages: t.galleryImages || [],
        rescueContact: t.rescueContact,
        region: t.region,
        permitRequired: t.permitRequired,
        permitInfo: t.permitInfo || '',
        maxAltitudeM: t.maxAltitudeM,
        elevationGainM: t.elevationGainM,
        distanceKm: t.distanceKm,
        bestMonths: t.bestMonths,
        avoidMonths: t.avoidMonths,
        altNames: t.altNames || [],
      };
      const initialInsertFields = {
        id: t.id,
        name: t.name,
        province: t.province,
        district: t.district,
        durationDays: t.durationDays,
        durationHoursNote: t.durationHoursNote,
        difficultyLevel: t.difficultyLevel,
        difficultyNote: t.difficultyNote,
        description: t.description,
        transportationInfo: t.transportationInfo,
        hasCampsite: t.hasCampsite,
        hasWaterSource: t.hasWaterSource,
        kidFriendly: t.kidFriendly,
        status: t.status,
        rating: t.rating,
        reviewCount: t.reviewCount,
        ...(adminUser ? { createdBy: adminUser._id } : {}),
      };

      await TrailModel.updateOne(
        { id: t.id },
        forceSync
          ? { $set: canonicalGeoAndMeta, $setOnInsert: initialInsertFields }
          : { $setOnInsert: { ...canonicalGeoAndMeta, ...initialInsertFields } },
        { upsert: true }
      );
    }

    const totalTrails = await TrailModel.countDocuments();
    console.log(`[MongoDB Seeder]: Verified ${totalTrails} Trails in MongoDB 'trails' collection.`);

    // 5. Non-Destructive SummitChallengeModel Upsert ($setOnInsert by default; $set only when FORCE_SEED_SYNC=true)
    if (VIETNAM_SUMMIT_CHALLENGES.length > 0) {
      await SummitChallengeModel.bulkWrite(
        VIETNAM_SUMMIT_CHALLENGES.map((c) => {
          const challengeFields = {
            title: c.title,
            subtitle: c.subtitle,
            description: c.description,
            badgeName: c.badgeName,
            tier: c.tier,
            region: c.region,
            ruleType: c.ruleType,
            requiredTrailSlugs: c.requiredTrailSlugs,
            ...(typeof c.minAltitudeM === 'number' ? { minAltitudeM: c.minAltitudeM } : {}),
            targetCount: c.targetCount,
            ...(typeof c.targetKm === 'number' ? { targetKm: c.targetKm } : {}),
            ...(typeof c.targetGainM === 'number' ? { targetGainM: c.targetGainM } : {}),
            rewardPoints: c.rewardPoints,
            coverImage: c.coverImage,
            isActive: c.isActive,
            sortOrder: c.sortOrder,
          };
          return {
            updateOne: {
              filter: { slug: c.slug },
              update: forceSync
                ? { $set: challengeFields, $setOnInsert: { slug: c.slug } }
                : { $setOnInsert: { slug: c.slug, ...challengeFields } },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
      const totalChallenges = await SummitChallengeModel.countDocuments();
      console.log(`[MongoDB Seeder]: Verified ${totalChallenges} Summit Challenges in 'summitchallenges' collection.`);
    }

    // 6. Non-Destructive RangerStationModel Upsert ($setOnInsert by default; $set only when FORCE_SEED_SYNC=true)
    if (VIETNAM_RANGER_STATIONS.length > 0) {
      await RangerStationModel.bulkWrite(
        VIETNAM_RANGER_STATIONS.map((s) => {
          const stationFields = {
            name: s.name,
            authorityType: s.authorityType,
            region: s.region,
            province: s.province,
            district: s.district,
            address: s.address,
            coordinates: s.coordinates,
            hotlinePhone: s.hotlinePhone,
            emergencyPhone: s.emergencyPhone,
            permitRequired: s.permitRequired,
            permitLeadDays: s.permitLeadDays,
            permitFeeNote: s.permitFeeNote,
            officeHours: s.officeHours,
            coveredTrailSlugs: s.coveredTrailSlugs,
            officialWebsite: s.officialWebsite,
            verifiedSource: s.verifiedSource,
            isActive: true,
          };
          return {
            updateOne: {
              filter: { slug: s.slug },
              update: forceSync
                ? { $set: stationFields, $setOnInsert: { slug: s.slug } }
                : { $setOnInsert: { slug: s.slug, ...stationFields } },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
      const totalRangers = await RangerStationModel.countDocuments();
      console.log(`[MongoDB Seeder]: Verified ${totalRangers} Ranger Stations in 'rangerstations' collection.`);
    }

    // 7. Seed initial Review for Fansipan if empty
    const fansipan = await TrailModel.findOne({ id: 'trail-fansipan' });
    if (fansipan && adminUser) {
      const reviewCount = await ReviewModel.countDocuments({ trailId: fansipan._id });
      if (reviewCount === 0) {
        await ReviewModel.create({
          trailId: fansipan._id,
          userId: adminUser._id,
          userName: adminUser.fullName,
          userAvatar: adminUser.avatarUrl,
          rating: 5,
          difficultyRating: 4,
          content:
            'Cung Fansipan Trạm Tôn tuyệt đẹp! Đoạn qua Lán 2.800m mây phủ ngập tràn, bình minh trên đỉnh 3.143m ấn tượng.',
          safetyNote: 'Đoạn vách đá gần đỉnh dốc gắt, chú ý bám chắc dây cáp.',
          tripDate: '2026-07-20',
        });
      }
    }

    // 8. Seed initial Incident for Tà Xùa using canonical slug 'trail-taxua' (consistent with createIncident & goNoGo)
    const taxua = await TrailModel.findOne({ id: 'trail-taxua' });
    if (taxua) {
      // Normalize any legacy seeded ObjectId trailId for Tà Xùa to canonical slug 'trail-taxua'
      await IncidentModel.updateMany(
        { trailId: { $in: [taxua._id, String(taxua._id)] } },
        { $set: { trailId: 'trail-taxua' } }
      );
    }
    if (adminUser) {
      const taxuaIncidentCount = await IncidentModel.countDocuments({ trailId: 'trail-taxua' });
      if (taxuaIncidentCount === 0) {
        await IncidentModel.create({
          trailId: 'trail-taxua',
          trailName: taxua?.name || 'Chinh Phục Sống Lưng Khủng Long Đỉnh Tà Xùa 2865m',
          severity: 'high',
          type: 'bad_weather',
          description: 'Sương mù dày đặc và gió giật mạnh cấp 6 trên Sống Lưng Khủng Long.',
          reportedBy: adminUser._id,
          reporterName: adminUser.fullName,
          reporterAvatar: adminUser.avatarUrl,
          reporterRole: adminUser.role,
          locationNote: 'Sống Lưng Khủng Long 2.550m (Tuyến Tà Xùa)',
          coordinates: { lat: 21.4165, lng: 104.3305 },
          elevationM: 2550,
          reportedAt: new Date().toISOString(),
          active: true,
          resolved: false,
        });
      }
    }

    // 9. Seed initial Forum Thread if empty
    const threadsCount = await ThreadModel.countDocuments();
    if (threadsCount === 0 && adminUser) {
      await ThreadModel.create({
        id: 'thread-1',
        title: 'Kinh nghiệm săn biển mây Lảo Thẩn 2026',
        authorName: adminUser.fullName,
        authorAvatar: adminUser.avatarUrl,
        authorBadge: 'Verified Guide',
        userId: adminUser._id,
        category: 'Kinh Nghiệm',
        content: 'Chia sẻ thời điểm săn mây đẹp nhất tại Y Tý từ tháng 10 đến tháng 3 năm sau...',
        upvotes: 0,
        reactions: { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, angry: 0, dislike: 0 },
        repliesCount: 0,
        viewsCount: 1,
      });
    }

    // 10. Seed initial Weather Forecast if empty
    const weatherCount = await WeatherForecastModel.countDocuments();
    if (weatherCount === 0 && fansipan) {
      await WeatherForecastModel.create({
        trailId: fansipan._id,
        forecastDate: new Date().toISOString().split('T')[0],
        tempMinC: 10,
        tempMaxC: 18,
        humidityPercent: 85,
        windSpeedKmH: 14,
        cloudCoverPercent: 90,
        seaOfCloudsIndex: 88,
        weatherCondition: 'cloudy',
      });
    }

    // 11. Seed Audit Log if empty
    const auditCount = await AuditLogModel.countDocuments();
    if (auditCount === 0) {
      await AuditLogModel.create({
        ...(adminUser ? { userId: adminUser._id } : {}),
        action: 'DATABASE_INITIALIZED',
        targetCollection: 'all_collections',
        details: 'LOST MongoDB collections initialized successfully.',
        ipAddress: '127.0.0.1',
      });
    }

    // 12. Keyed Non-Destructive Upsert for AI Knowledge Base
    // Migrates any legacy unkeyed docs matching seeded questions (preserving viewCount & custom admin docs)
    // and upserts all masterKnowledgeDataset items by unique `key` + `searchTextNormalized`.
    if (masterKnowledgeDataset.length > 0) {
      const legacyUnkeyed = await AiKnowledgeModel.find({
        $or: [{ key: { $exists: false } }, { key: '' }, { key: null }],
      })
        .select('_id question')
        .lean();

      if (legacyUnkeyed.length > 0) {
        const questionToKey = new Map<string, string>();
        for (const item of masterKnowledgeDataset) {
          questionToKey.set(item.question, item.id);
        }
        const existingKeyed = new Set(
          (await AiKnowledgeModel.find({ key: { $exists: true, $nin: ['', null] } }).select('key').lean()).map((d) =>
            String(d.key)
          )
        );
        const claimed = new Set<string>(existingKeyed);
        const migrateOps: Parameters<typeof AiKnowledgeModel.bulkWrite>[0] = [];
        for (const doc of legacyUnkeyed) {
          const matchedKey = questionToKey.get(doc.question);
          if (!matchedKey) continue;
          if (claimed.has(matchedKey)) {
            migrateOps.push({ deleteOne: { filter: { _id: doc._id } } });
          } else {
            claimed.add(matchedKey);
            migrateOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { key: matchedKey } } } });
          }
        }
        if (migrateOps.length > 0) {
          await AiKnowledgeModel.bulkWrite(migrateOps, { ordered: false });
        }
      }

      const bulkOps = masterKnowledgeDataset.map((item) => {
        const searchTextNormalized = removeVietnameseDiacritics(
          [item.question, item.trailName || '', ...(item.keywords || []), item.answer.slice(0, 320)].join(' ')
        );
        const knowledgeFields = {
          category: item.category,
          trailId: item.trailId,
          trailName: item.trailName,
          question: item.question,
          keywords: item.keywords,
          answer: item.answer,
          searchTextNormalized,
          difficultyLevel: item.difficultyLevel,
          sourceOrHotline: item.sourceOrHotline,
          isActive: true,
        };
        return {
          updateOne: {
            filter: { key: item.id },
            update: forceSync
              ? {
                  $set: knowledgeFields,
                  $setOnInsert: { key: item.id, viewCount: 0 },
                }
              : {
                  $setOnInsert: { key: item.id, viewCount: 0, ...knowledgeFields },
                },
            upsert: true,
          },
        };
      });
      await AiKnowledgeModel.bulkWrite(bulkOps, { ordered: false });
      const totalKnowledge = await AiKnowledgeModel.countDocuments();
      console.log(`[MongoDB Seeder]: Verified ${totalKnowledge} keyed AI Knowledge entries.`);
    }

    // 13. Non-destructive backfill of indexed `usernameLower` and `passportCode` for legacy users
    try {
      const legacyUsers = await UserModel.find({
        $or: [
          { usernameLower: { $exists: false } },
          { usernameLower: null },
          { usernameLower: '' },
          { passportCode: { $exists: false } },
          { passportCode: null },
          { passportCode: '' },
        ],
      })
        .select('_id username usernameLower passportCode')
        .lean();

      for (const u of legacyUsers) {
        const patch: Record<string, string> = {};
        if (!u.usernameLower && typeof u.username === 'string' && u.username.trim()) {
          patch.usernameLower = u.username.trim().toLowerCase();
        }
        if (!u.passportCode) {
          patch.passportCode = `LS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        }
        if (Object.keys(patch).length > 0) {
          await UserModel.updateOne({ _id: u._id }, { $set: patch }).catch(() => {});
        }
      }
    } catch (backfillErr) {
      console.warn('[MongoDB Seeder]: User index backfill notice:', (backfillErr as Error).message);
    }

    console.log('[MongoDB Seeder]: Idempotent sync complete.');
    return true;
  } catch (error) {
    console.error('[MongoDB Seeder Error]:', (error as Error).message);
    return false;
  }
};
