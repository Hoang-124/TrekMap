import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { GuideModel } from '../models/Guide.js';
import { IncidentModel } from '../models/Incident.js';
import { CategoryModel } from '../models/Category.js';
import { ReviewModel } from '../models/Review.js';
import { ThreadModel } from '../models/Thread.js';
import { WeatherForecastModel } from '../models/WeatherForecast.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { AiKnowledgeModel } from '../models/AiKnowledge.js';
import { mockTrails, mockGuides } from '../data/seedData.js';
import { masterKnowledgeDataset } from '../data/trekkerKnowledgeDataset.js';

import { hashPassword } from './auth.js';

export const seedAll13Collections = async () => {
  try {
    console.log('🌱 [MongoDB Seeder]: Initializing direct MongoDB seeding process...');

    // 1. Seed Categories
    const categoriesCount = await CategoryModel.countDocuments();
    if (categoriesCount === 0) {
      await CategoryModel.insertMany([
        { name: 'Kinh Nghiệm', slug: 'kinh-nghiem', description: 'Chia sẻ kinh nghiệm trekking thực tế', icon: 'Compass' },
        { name: 'Hỏi Đáp', slug: 'hoi-dap', description: 'Góc giải đáp thắc mắc cung đường', icon: 'HelpCircle' },
        { name: 'Tìm Đồng Đội', slug: 'tim-dong-doi', description: 'Lập nhóm ghép đoàn leo núi', icon: 'Users' },
        { name: 'Cảnh Báo', slug: 'canh-bao', description: 'Thông tin thời tiết và cứu hộ khẩn cấp', icon: 'AlertTriangle' },
      ]);
    }

    // 2. Seed Admin User
    let adminUser = await UserModel.findOne({ email: 'hoang@trekmap.vn' });
    if (!adminUser) {
      adminUser = await UserModel.create({
        username: 'hoangtrekker',
        email: 'hoang@trekmap.vn',
        passwordHash: hashPassword('admin123'),
        fullName: 'Hoàng Trekker (Verified Guide)',
        avatarUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg',
        role: 'admin',
        authProvider: 'local',
        isEmailVerified: true,
        reputationScore: 1250,
        badges: ['Top Contributor', 'Verified Guide', 'Fansipan Summitter'],
      });
    }

    // 3. Seed Guides
    const guidesCount = await GuideModel.countDocuments();
    if (guidesCount === 0) {
      await GuideModel.insertMany(
        mockGuides.map((g) => ({
          name: g.name,
          phone: g.phone,
          avatarUrl: g.avatarUrl,
          region: g.region,
          provinces: [g.region === 'Miền Bắc' ? 'Lào Cai' : 'Lâm Đồng'],
          priceNote: g.priceNote,
          verified: g.verified,
          rating: g.rating,
          reviewCount: g.reviewCount,
        }))
      );
    }

    // 4. Force Seed/Upsert ALL 12 Trails directly into MongoDB `trails` collection
    for (const t of mockTrails) {
      const { createdBy, ...trailBody } = t;
      await TrailModel.findOneAndUpdate(
        { name: t.name },
        {
          ...trailBody,
          id: t.id,
          createdBy: adminUser._id as any,
          startLocation: {
            type: 'Point',
            coordinates: [t.startLng, t.startLat],
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const totalTrails = await TrailModel.countDocuments();
    console.log(`✅ [MongoDB Seeder]: Successfully synced ${totalTrails} Trails in MongoDB 'trails' collection!`);

    // 5. Seed Reviews for Fansipan
    const fansipan = await TrailModel.findOne({ name: /Fansipan/ });
    if (fansipan) {
      const reviewCount = await ReviewModel.countDocuments({ trailId: fansipan._id } as any);
      if (reviewCount === 0) {
        await ReviewModel.create({
          trailId: fansipan._id as any,
          userId: adminUser._id as any,
          userName: adminUser.fullName,
          userAvatar: adminUser.avatarUrl,
          rating: 5,
          difficultyRating: 4,
          content: 'Cung Fansipan Trạm Tôn tuyệt đẹp! Đoạn qua Lán 2800m mây phủ ngập tràn, bình minh trên đỉnh 3143m phê không lời nào tả xiết.',
          safetyNote: 'Đoạn vách đá gần đỉnh dốc gắt, chú ý bám chắc dây cáp.',
          tripDate: '2026-07-20',
        });
      }
    }

    // 6. Seed Incidents for Tà Xùa
    const taxua = await TrailModel.findOne({ name: /Tà Xùa/ });
    if (taxua) {
      const incidentCount = await IncidentModel.countDocuments({ trailId: taxua._id } as any);
      if (incidentCount === 0) {
        await IncidentModel.create({
          trailId: taxua._id as any,
          trailName: taxua.name,
          severity: 'high',
          type: 'bad_weather',
          description: 'Sương mù dày đặc và gió giật mạnh cấp 6 trên Sống Lưng Khủng Long.',
          reportedBy: adminUser._id as any,
          reportedAt: new Date().toISOString(),
          active: true,
        });
      }
    }

    // 7. Seed Forum Threads
    const threadsCount = await ThreadModel.countDocuments();
    if (threadsCount === 0) {
      await ThreadModel.create({
        id: 'thread-1',
        title: 'Kinh nghiệm săn biển mây Lảo Thẩn 2026',
        authorName: 'Hoàng Trekker',
        authorAvatar: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg',
        authorBadge: 'Verified Guide',
        userId: adminUser._id as any,
        category: 'Kinh Nghiệm',
        content: 'Chia sẻ thời điểm săn mây đẹp nhất tại Y Tý từ tháng 10 đến tháng 3 năm sau...',
        upvotes: 42,
        reactions: { like: 30, love: 10, haha: 0, wow: 12, buon: 0, huhu: 0, angry: 0, dislike: 0 },
        repliesCount: 8,
        viewsCount: 250,
      });
    }

    // 8. Seed Weather Forecasts
    const weatherCount = await WeatherForecastModel.countDocuments();
    if (weatherCount === 0 && fansipan) {
      await WeatherForecastModel.create({
        trailId: fansipan._id as any,
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

    // 9. Seed Audit Log
    const auditCount = await AuditLogModel.countDocuments();
    if (auditCount === 0) {
      await AuditLogModel.create({
        userId: adminUser._id as any,
        action: 'DATABASE_INITIALIZED',
        targetCollection: 'all_collections',
        details: 'TrekMap 15 MongoDB collections initialized successfully.',
        ipAddress: '127.0.0.1',
      });
    }

    // 10. Seed/Sync AI Master Knowledge Base into MongoDB
    const aiKnowledgeCount = await AiKnowledgeModel.countDocuments();
    if (aiKnowledgeCount < masterKnowledgeDataset.length) {
      console.log(`🤖 [MongoDB Seeder]: Syncing ${masterKnowledgeDataset.length} AI Knowledge items into MongoDB...`);
      await AiKnowledgeModel.deleteMany({});
      await AiKnowledgeModel.insertMany(
        masterKnowledgeDataset.map((item) => ({
          category: item.category,
          trailId: item.trailId,
          trailName: item.trailName,
          question: item.question,
          keywords: item.keywords,
          answer: item.answer,
          difficultyLevel: item.difficultyLevel,
          sourceOrHotline: item.sourceOrHotline,
          isActive: true,
          viewCount: 0,
        }))
      );
      console.log(`✅ [MongoDB Seeder]: Successfully seeded ${masterKnowledgeDataset.length} AI Knowledge items into MongoDB!`);
    }

    console.log('🎉 [MongoDB Seeder]: ALL real Vietnam trails and AI Knowledge persisted into MongoDB database!');
  } catch (error) {
    console.error('⚠️ [MongoDB Seeder Notice]:', (error as Error).message);
  }
};
