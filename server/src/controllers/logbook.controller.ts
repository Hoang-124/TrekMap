import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { CheckinModel } from '../models/Checkin.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { isValidObjectId, resolveTrailObjectId } from '../utils/resolveTrail.js';
import { sanitizeInput, isSafeHttpUrl } from '../utils/validation.js';

function parseStrictFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

// GET /api/logbook/me - Paginated Personal Trek Logbook (filterable by year, region, verifiedOnly, trailId)
export const getMyLogbook = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xem Nhật Ký Trekking.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [], pagination: { total: 0, page: 1, limit: 20 } });
    }

    const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 1000);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 60);
    const skip = (page - 1) * limit;

    const filter: any = { userId: new Types.ObjectId(userId) };

    if (req.query.verifiedOnly === 'true') {
      filter.verifiedBadge = true;
    }
    if (typeof req.query.year === 'string' && /^\d{4}$/.test(req.query.year)) {
      const y = Number(req.query.year);
      filter.checkinDate = {
        $gte: new Date(Date.UTC(y, 0, 1)),
        $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
    }
    let explicitTrailId: Types.ObjectId | null = null;
    if (typeof req.query.trailId === 'string' && req.query.trailId.trim()) {
      const resolved = await resolveTrailObjectId(req.query.trailId.trim());
      if (resolved) {
        explicitTrailId = resolved;
        filter.trailId = resolved;
      } else {
        return res.json({ success: true, count: 0, data: [], pagination: { total: 0, page, limit } });
      }
    }
    if (typeof req.query.region === 'string' && ['Miền Bắc', 'Miền Trung', 'Miền Nam'].includes(req.query.region)) {
      const regionVal = req.query.region as 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
      const regionalTrails = await TrailModel.find({ region: regionVal }).select('_id').lean();
      if (explicitTrailId) {
        const matchesRegion = regionalTrails.some((t) => String(t._id) === String(explicitTrailId));
        if (!matchesRegion) {
          return res.json({ success: true, count: 0, data: [], pagination: { total: 0, page, limit } });
        }
      } else {
        filter.trailId = { $in: regionalTrails.map((t) => t._id) };
      }
    }

    const [entries, total] = await Promise.all([
      CheckinModel.find(filter)
        .populate('trailId', 'id name province district region distanceKm elevationGainM maxAltitudeM difficultyLevel coverImage')
        .sort({ checkinDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CheckinModel.countDocuments(filter),
    ]);

    const formatted = entries.map((e: any) => ({
      ...e,
      hasRecordedGpx: Array.isArray(e.gpxTrackRecorded) && e.gpxTrackRecorded.length >= 2,
      recordedPointsCount: Array.isArray(e.gpxTrackRecorded) ? e.gpxTrackRecorded.length : 0,
      effectiveDistanceKm: e.distanceRecordedKm ?? e.trailId?.distanceKm ?? 0,
      effectiveElevationGainM: e.elevationGainRecordedM ?? e.trailId?.elevationGainM ?? 0,
    }));

    return res.json({
      success: true,
      count: formatted.length,
      data: formatted,
      pagination: { total, page, limit },
    });
  } catch (err) {
    console.error('[Get My Logbook Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải Nhật Ký Trekking cá nhân.' });
  }
};

// PATCH /api/logbook/:checkinId - Update personal logbook notes/metrics (strict owner check)
export const updateLogbookEntry = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { checkinId } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(checkinId)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const body = req.body || {};
    const update: Record<string, any> = {};

    if (body.completionTimeHours !== undefined) {
      const hrs = parseStrictFiniteNumber(body.completionTimeHours);
      if (hrs === null || hrs < 0.2 || hrs > 240) {
        return res.status(400).json({ success: false, message: 'Thời gian hoàn thành phải từ 0.2 đến 240 giờ.' });
      }
      update.completionTimeHours = hrs;
    }
    if (body.distanceRecordedKm !== undefined) {
      const km = parseStrictFiniteNumber(body.distanceRecordedKm);
      if (km === null || km < 0 || km > 500) {
        return res.status(400).json({ success: false, message: 'Quãng đường ghi nhận phải từ 0 đến 500 km.' });
      }
      update.distanceRecordedKm = Math.round(km * 100) / 100;
    }
    if (body.elevationGainRecordedM !== undefined) {
      const gain = parseStrictFiniteNumber(body.elevationGainRecordedM);
      if (gain === null || gain < 0 || gain > 30000) {
        return res.status(400).json({ success: false, message: 'Tổng độ cao tích lũy phải từ 0 đến 30.000 m.' });
      }
      update.elevationGainRecordedM = Math.round(gain);
    }
    if (typeof body.weatherObserved === 'string') {
      update.weatherObserved = sanitizeInput(body.weatherObserved).slice(0, 160);
    }
    if (body.packWeightKg !== undefined) {
      const kg = parseStrictFiniteNumber(body.packWeightKg);
      if (kg === null || kg < 0 || kg > 60) {
        return res.status(400).json({ success: false, message: 'Trọng lượng balo phải từ 0 đến 60 kg.' });
      }
      update.packWeightKg = Math.round(kg * 10) / 10;
    }
    if (typeof body.notes === 'string') {
      update.notes = sanitizeInput(body.notes).slice(0, 1500);
    }
    if (body.companionsCount !== undefined) {
      const rawComp = parseStrictFiniteNumber(body.companionsCount);
      const c = rawComp !== null ? Math.round(rawComp) : NaN;
      if (!Number.isFinite(c) || c < 1 || c > 100) {
        return res.status(400).json({ success: false, message: 'Số thành viên đồng hành phải từ 1 đến 100 người.' });
      }
      update.companionsCount = c;
    }
    if (typeof body.isPublic === 'boolean') {
      update.isPublic = body.isPublic;
    }
    if (Array.isArray(body.photos)) {
      update.photos = body.photos.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 6);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có trường dữ liệu hợp lệ để cập nhật.' });
    }

    const updated = await CheckinModel.findOneAndUpdate(
      { _id: checkinId, userId: new Types.ObjectId(userId) },
      { $set: update },
      { new: true }
    )
      .populate('trailId', 'id name province region distanceKm elevationGainM maxAltitudeM difficultyLevel coverImage')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhật ký của bạn.' });
    }

    return res.json({ success: true, message: 'Đã cập nhật nhật ký hành trình!', data: updated });
  } catch (err) {
    console.error('[Update Logbook Entry Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật nhật ký hành trình.' });
  }
};

// DELETE /api/logbook/:checkinId - Delete logbook entry & keep User.checkedInTrails synced
export const deleteLogbookEntry = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { checkinId } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(checkinId)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const deleted = await CheckinModel.findOneAndDelete({ _id: checkinId, userId: uid });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhật ký để xóa.' });
    }

    // Remove trailId from User.checkedInTrails ONLY if user has no remaining check-ins for that trail
    const stillExists = await CheckinModel.exists({ userId: uid, trailId: deleted.trailId });
    if (!stillExists) {
      await UserModel.updateOne({ _id: uid }, { $pull: { checkedInTrails: deleted.trailId } }).catch(() => {});
    }

    return res.json({ success: true, message: 'Đã xóa bản ghi nhật ký hành trình.' });
  } catch (err) {
    console.error('[Delete Logbook Entry Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa nhật ký hành trình.' });
  }
};

// GET /api/logbook/analytics/me - Single $facet aggregation for Profile SVG Charts (monthly km/elevation, regions, records)
export const getMyLogbookAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xem thống kê hành trình.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    // Compute 12-month boundary strictly in Vietnam local timezone (Asia/Ho_Chi_Minh, UTC+7)
    const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const vnYear = vnNow.getUTCFullYear();
    const vnMonthIdx = vnNow.getUTCMonth(); // 0..11
    const twelveMonthsAgo = new Date(Date.UTC(vnYear, vnMonthIdx - 11, 1) - 7 * 60 * 60 * 1000);

    const [facetResult, regionTrailTotals] = await Promise.all([
      CheckinModel.aggregate([
        { $match: { userId: uid } },
        {
          $lookup: {
            from: 'trails',
            localField: 'trailId',
            foreignField: '_id',
            as: 'trail',
          },
        },
        { $unwind: { path: '$trail', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            effDistanceKm: { $ifNull: ['$distanceRecordedKm', { $ifNull: ['$trail.distanceKm', 0] }] },
            effGainM: { $ifNull: ['$elevationGainRecordedM', { $ifNull: ['$trail.elevationGainM', 0] }] },
            effMaxAltM: { $ifNull: ['$trail.maxAltitudeM', 0] },
            effRegion: { $ifNull: ['$trail.region', 'Miền Bắc'] },
            effDifficulty: { $ifNull: ['$trail.difficultyLevel', 3] },
            effTrailName: { $ifNull: ['$trail.name', 'Cung đường'] },
            effTrailSlug: { $ifNull: ['$trail.id', { $toString: '$trailId' }] },
            effDate: { $ifNull: ['$checkinDate', '$createdAt'] },
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalTrips: { $sum: 1 },
                  uniqueTrailIds: { $addToSet: '$trailId' },
                  verifiedGpsCount: { $sum: { $cond: ['$verifiedBadge', 1, 0] } },
                  totalDistanceKm: { $sum: '$effDistanceKm' },
                  totalElevationGainM: { $sum: '$effGainM' },
                  totalHours: { $sum: { $ifNull: ['$completionTimeHours', 0] } },
                  highestAltitudeM: { $max: '$effMaxAltM' },
                },
              },
            ],
            monthly: [
              { $match: { effDate: { $gte: twelveMonthsAgo } } },
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m', date: '$effDate', timezone: 'Asia/Ho_Chi_Minh' } },
                  trips: { $sum: 1 },
                  distanceKm: { $sum: '$effDistanceKm' },
                  elevationGainM: { $sum: '$effGainM' },
                  hours: { $sum: { $ifNull: ['$completionTimeHours', 0] } },
                },
              },
              { $sort: { _id: 1 } },
            ],
            regions: [
              {
                $group: {
                  _id: '$effRegion',
                  uniqueTrails: { $addToSet: '$trailId' },
                  trips: { $sum: 1 },
                  distanceKm: { $sum: '$effDistanceKm' },
                  elevationGainM: { $sum: '$effGainM' },
                },
              },
            ],
            difficulties: [
              {
                $group: {
                  _id: '$effDifficulty',
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            highestPeak: [
              { $sort: { effMaxAltM: -1, effDate: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, trailSlug: '$effTrailSlug', trailName: '$effTrailName', maxAltitudeM: '$effMaxAltM', date: '$effDate' } },
            ],
            longestTrek: [
              { $sort: { effDistanceKm: -1, effDate: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, trailSlug: '$effTrailSlug', trailName: '$effTrailName', distanceKm: '$effDistanceKm', date: '$effDate' } },
            ],
            mostVisited: [
              {
                $group: {
                  _id: '$trailId',
                  trailSlug: { $first: '$effTrailSlug' },
                  trailName: { $first: '$effTrailName' },
                  visits: { $sum: 1 },
                },
              },
              { $sort: { visits: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, trailSlug: 1, trailName: 1, visits: 1 } },
            ],
          },
        },
      ]),
      TrailModel.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$region', totalAvailable: { $sum: 1 } } },
      ]),
    ]);

    const facets = facetResult[0] || {};
    const rawSum = facets.summary?.[0];
    const totalDistanceKm = Math.round((rawSum?.totalDistanceKm || 0) * 10) / 10;
    const totalHours = Math.round((rawSum?.totalHours || 0) * 10) / 10;
    const highestPeakDoc = facets.highestPeak?.[0] || null;

    // Build zero-filled 12-month chronological series for clean SVG bar/line charts
    const monthlyLookup = new Map<string, any>();
    for (const m of facets.monthly || []) {
      monthlyLookup.set(m._id, m);
    }
    const monthlySeries: Array<{
      month: string;
      label: string;
      trips: number;
      distanceKm: number;
      elevationGainM: number;
      hours: number;
    }> = [];
    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(Date.UTC(vnYear, vnMonthIdx - offset, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const row = monthlyLookup.get(key);
      monthlySeries.push({
        month: key,
        label: `T${d.getUTCMonth() + 1}`,
        trips: row?.trips || 0,
        distanceKm: Math.round((row?.distanceKm || 0) * 10) / 10,
        elevationGainM: Math.round(row?.elevationGainM || 0),
        hours: Math.round((row?.hours || 0) * 10) / 10,
      });
    }

    // Regional conquest breakdown
    const availMap = new Map<string, number>();
    regionTrailTotals.forEach((r: any) => availMap.set(String(r._id), r.totalAvailable));
    const userRegionMap = new Map<string, any>();
    (facets.regions || []).forEach((r: any) => userRegionMap.set(String(r._id), r));

    const regionBreakdown = (['Miền Bắc', 'Miền Trung', 'Miền Nam'] as const).map((region) => {
      const u = userRegionMap.get(region);
      const uniqueConquered = u?.uniqueTrails?.length || 0;
      const totalAvailable = availMap.get(region) || 0;
      return {
        region,
        uniqueConquered,
        totalAvailable,
        conquestPercent: totalAvailable > 0 ? Math.min(100, Math.round((uniqueConquered / totalAvailable) * 100)) : 0,
        trips: u?.trips || 0,
        distanceKm: Math.round((u?.distanceKm || 0) * 10) / 10,
        elevationGainM: Math.round(u?.elevationGainM || 0),
      };
    });

    // Difficulty distribution (levels 1..5 always populated)
    const diffMap = new Map<number, number>();
    (facets.difficulties || []).forEach((d: any) => diffMap.set(Number(d._id), d.count));
    const difficultyDistribution = [1, 2, 3, 4, 5].map((level) => ({
      level,
      count: diffMap.get(level) || 0,
    }));

    return res.json({
      success: true,
      data: {
        summary: {
          totalTrips: rawSum?.totalTrips || 0,
          uniqueTrails: rawSum?.uniqueTrailIds?.length || 0,
          verifiedGpsCount: rawSum?.verifiedGpsCount || 0,
          totalDistanceKm,
          totalElevationGainM: Math.round(rawSum?.totalElevationGainM || 0),
          totalHours,
          highestAltitudeM: rawSum?.highestAltitudeM || 0,
          highestPeakName: highestPeakDoc?.trailName || 'Chưa ghi nhận',
          avgPaceKmH: totalHours > 0 ? Math.round((totalDistanceKm / totalHours) * 100) / 100 : 0,
        },
        monthlySeries,
        regionBreakdown,
        difficultyDistribution,
        personalRecords: {
          highestPeak: highestPeakDoc,
          longestTrek: facets.longestTrek?.[0] || null,
          mostVisitedTrail: facets.mostVisited?.[0] || null,
        },
      },
    });
  } catch (err) {
    console.error('[Get Logbook Analytics Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tổng hợp phân tích hành trình cá nhân.' });
  }
};

// GET /api/logbook/:checkinId/gpx - Export personal recorded GPX tracklog (owner or isPublic)
export const exportLogbookGpx = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { checkinId } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(checkinId)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const entry: any = await CheckinModel.findById(checkinId)
      .populate('trailId', 'id name gpxTrack')
      .lean();
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhật ký.' });
    }

    const isOwner = String(entry.userId) === String(userId);
    // Privacy-by-default: non-owner GPX export requires explicit isPublic === true opt-in
    if (!isOwner && entry.isPublic !== true && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Nhật ký GPX này đang ở chế độ riêng tư.' });
    }

    const points =
      Array.isArray(entry.gpxTrackRecorded) && entry.gpxTrackRecorded.length >= 2
        ? entry.gpxTrackRecorded
        : Array.isArray(entry.trailId?.gpxTrack) && entry.trailId.gpxTrack.length >= 2
          ? entry.trailId.gpxTrack
          : [];

    if (points.length < 2) {
      return res.status(404).json({ success: false, message: 'Bản ghi này chưa có dữ liệu tracklog GPX.' });
    }

    const rawDate = new Date(entry.checkinDate || entry.createdAt || Date.now());
    const safeIso = Number.isNaN(rawDate.getTime()) ? new Date().toISOString() : rawDate.toISOString();
    const trailName = entry.trailId?.name || 'LOST Personal Tracklog';
    const safeName = escapeXml(`${trailName} (${safeIso.split('T')[0]})`);
    const trkpts = points
      .filter((pt: any) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])))
      .map((pt: any) => `      <trkpt lat="${Number(pt[0])}" lon="${Number(pt[1])}"></trkpt>`)
      .join('\n');

    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Vietnam Logbook - https://lost.vn" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <time>${safeIso}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lost-log-${checkinId}.gpx"`);
    return res.send(gpxXml);
  } catch (err) {
    console.error('[Export Logbook GPX Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xuất file GPX cá nhân.' });
  }
};
