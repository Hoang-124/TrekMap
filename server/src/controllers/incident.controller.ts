import { Request, Response } from 'express';
import { Incident } from '../types.js';
import { IncidentModel } from '../models/Incident.js';
import { UserModel } from '../models/User.js';
import { mockIncidents, mockTrails } from '../data/seedData.js';
import { broadcastEvent } from '../config/socket.js';
import { getNaturalHazardsAlerts, getLiveWeatherForecast } from '../services/publicApis.service.js';
import { sendNotification, notifyAdmins } from '../utils/notification.js';

let inMemoryIncidents: Incident[] = [...mockIncidents];

export const getIncidents = async (req: Request, res: Response) => {
  let dbIncidents: any[] = [];
  try {
    dbIncidents = await IncidentModel.find({ active: { $ne: false } }).sort({ createdAt: -1 }).lean().exec();
  } catch (err) {}

  const REGIONS = [
    { id: 'trail-fansipan', name: 'Chinh Phục Fansipan (Trạm Tôn)', lat: 22.3564, lng: 103.7741, elev: 2200, rescue: '0214.3871.234 - Hotline Cứu Hộ Sapa 24/7' },
    { id: 'trail-taxua', name: 'Tà Xùa (Sống Lưng Khủng Long)', lat: 21.2642, lng: 104.3511, elev: 1850, rescue: '0988.776.554 - Trạm Cứu Hộ Háng Đồng' },
    { id: 'trail-tanangphandung', name: 'Cung đường Tà Năng - Phan Dũng', lat: 11.5540, lng: 108.5410, elev: 1100, rescue: '0252.3838.115 - Cứu Hộ Phan Dũng' },
    { id: 'trail-kyquansan', name: 'Ky Quan San (Bạch Mộc Lương Tử)', lat: 22.5080, lng: 103.5870, elev: 2100, rescue: '0214.3871.115 - Trạm Kiểm Lâm Bát Xát' },
  ];

  const liveWeatherIncidents: Incident[] = [];

  try {
    const weatherResults = await Promise.all(
      REGIONS.map((r) => getLiveWeatherForecast(r.lat, r.lng))
    );

    weatherResults.forEach((wData, idx) => {
      const reg = REGIONS[idx];
      if (wData && wData.current_weather) {
        const temp = wData.current_weather.temperature;
        const wind = wData.current_weather.windspeed;
        const wcode = wData.current_weather.weathercode;

        let conditionText = `Cập nhật thời tiết thực tế ${reg.name}: ${temp}°C, Gió ${wind}km/h. Tuyến đường trekking an toàn.`;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

        if (temp < 5 || wind > 25 || wcode > 50) {
          conditionText = `Cảnh báo gió mạnh ${wind}km/h & nhiệt độ ${temp}°C tại ${reg.name}. Khuyến cáo trang bị ấm chống nước.`;
          severity = 'high';
        }

        liveWeatherIncidents.push({
          id: `weather-live-${reg.id}-${Date.now()}`,
          trailId: reg.id,
          trailName: reg.name,
          userName: 'Trạm Vệ Tinh Khí Tượng Real-time (Open-Meteo)',
          userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
          type: 'weather',
          description: conditionText,
          severity,
          reportedAt: 'Trực tiếp 100% từ Vệ tinh Khí tượng',
          resolved: false,
          locationNote: `${reg.name} (${reg.lat.toFixed(4)}° N, ${reg.lng.toFixed(4)}° E)`,
          coordinates: { lat: reg.lat, lng: reg.lng },
          elevationM: reg.elev,
          verifiedBy: 'Open-Meteo Live Telemetry & Trạm Kiểm Lâm Địa Phương',
          verifiedAt: 'Vừa cập nhật theo thời gian thực',
          rescueContact: reg.rescue,
          images: [
            'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
          ],
        });
      }
    });
  } catch (err) {
    console.error('Error fetching live weather telemetry:', err);
  }

  // Fetch live NASA EONET hazards
  let nasaIncidents: Incident[] = [];
  try {
    const nasaEvents = await getNaturalHazardsAlerts();
    nasaIncidents = nasaEvents.map((evt: any) => ({
      id: `nasa-${evt.id}`,
      trailId: 'trail-fansipan',
      trailName: `[Vệ Tinh NASA Real-time] ${evt.title}`,
      userName: 'NASA Earth Observatory EONET API',
      type: 'bad_weather',
      description: `Cảnh báo thiên tai tự nhiên toàn cầu từ vệ tinh NASA: ${evt.title} (${evt.category}). Tọa độ: ${evt.coordinates[1]?.toFixed(2)}°N, ${evt.coordinates[0]?.toFixed(2)}°E.`,
      severity: 'critical',
      resolved: false,
      reportedAt: evt.date ? evt.date.substring(0, 10) : 'Trực tiếp',
      locationNote: `Tọa độ Vệ tinh NASA: ${evt.coordinates[1]?.toFixed(2)}, ${evt.coordinates[0]?.toFixed(2)}`,
      coordinates: { lat: evt.coordinates[1] || 22.35, lng: evt.coordinates[0] || 103.77 },
      verifiedBy: 'NASA Goddard Space Flight Center',
      verifiedAt: 'Truyền dữ liệu vệ tinh mở 24/7',
      rescueContact: '114 / 115 - Cứu Hộ Khẩn Cấp',
      images: [
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
      ],
    }));
  } catch (err) {}

  const merged = [
    ...dbIncidents.filter((i: any) => i.active !== false && !i.resolved),
    ...inMemoryIncidents.filter((i: any) => !i.resolved),
    ...liveWeatherIncidents,
    ...nasaIncidents.slice(0, 2),
  ];

  res.json({
    success: true,
    count: merged.length,
    data: merged,
    source: 'MongoDB Persistent & Live Open-Meteo / NASA EONET',
  });
};

export const createIncident = async (req: Request, res: Response) => {
  const { trailId, trailName, type, description, severity, locationNote, coordinates } = req.body;

  const foundMock = mockTrails.find((t) => t.id === trailId || (t as any)._id === trailId || t.name === trailName);
  const actualTrailId = trailId || (foundMock ? foundMock.id : 'trail-fansipan');
  const actualTrailName = trailName || foundMock?.name || 'Tuyến đường Trekking';
  const actualCoords = coordinates || (foundMock ? { lat: foundMock.startLat, lng: foundMock.startLng } : { lat: 16.047, lng: 108.206 });
  const actualRescue = foundMock?.rescueContact?.phone || '114 / 115 - Cứu Hộ Khẩn Cấp';

  // Identify Reporter User
  const authUser = (req as any).user;
  let reportedById = authUser?.userId || authUser?._id || authUser?.id || req.body.reportedBy || null;
  let reporterName = req.body.reporterName || authUser?.fullName || authUser?.username || 'Trekker Thực Địa';
  let reporterEmail = req.body.reporterEmail || authUser?.email || '';
  let reporterAvatar = req.body.reporterAvatar || authUser?.avatarUrl || '';
  let reporterRole = req.body.reporterRole || authUser?.role || 'user';

  if (reportedById || reporterEmail) {
    try {
      let uDoc: any = null;
      if (typeof reportedById === 'string' && reportedById.length === 24) {
        uDoc = await UserModel.findById(reportedById).select('fullName username email avatarUrl role isBanned');
      } else if (reporterEmail) {
        uDoc = await UserModel.findOne({ email: reporterEmail }).select('fullName username email avatarUrl role isBanned');
      }
      if (uDoc) {
        if (uDoc.isBanned) {
          return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa do vi phạm hoặc phát cảnh báo sai sự thật.' });
        }
        reporterName = uDoc.fullName || uDoc.username || reporterName;
        reporterEmail = uDoc.email || reporterEmail;
        reporterAvatar = uDoc.avatarUrl || reporterAvatar;
        reporterRole = uDoc.role || reporterRole;
      }
    } catch (e) {}
  }

  const typeImagesMap: Record<string, string[]> = {
    landslide: ['https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'],
    flood: ['https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80'],
    weather: ['https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80'],
    wildlife: ['https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80'],
    lost: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80'],
    other: ['https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80'],
  };

  const autoImages = typeImagesMap[type || 'landslide'] || ['https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80'];

  const newIncident: any = {
    id: `inc-${Date.now()}`,
    trailId: actualTrailId,
    trailName: actualTrailName,
    reportedBy: reportedById,
    reporterName,
    reporterEmail,
    reporterAvatar,
    reporterRole,
    userName: reporterName,
    userAvatar: reporterAvatar,
    type: type || 'landslide',
    description: description || 'Báo cáo nguy hiểm thực địa.',
    severity: severity || 'high',
    resolved: false,
    reportedAt: 'Vừa xong',
    locationNote: locationNote || `Khu vực: ${actualTrailName}`,
    coordinates: actualCoords,
    rescueContact: actualRescue,
    images: autoImages,
    confirmations: 1,
    coReporters: [
      {
        userId: reportedById,
        userName: reporterName,
        userEmail: reporterEmail,
        userAvatar: reporterAvatar,
        confirmedAt: 'Vừa xong',
        note: locationNote || 'Báo cáo khởi tạo',
      },
    ],
    timelineUpdates: [
      {
        id: `upd-${Date.now()}`,
        userId: reportedById,
        userName: reporterName,
        userEmail: reporterEmail,
        userAvatar: reporterAvatar,
        content: description || 'Báo cáo ban đầu về tình trạng nguy hiểm.',
        statusNote: 'Khởi tạo cảnh báo',
        createdAt: 'Vừa xong',
      },
    ],
    safetyReports: [],
  };

  try {
    await IncidentModel.create({
      trailId: actualTrailId,
      trailName: actualTrailName,
      reportedBy: reportedById,
      reporterName,
      reporterEmail,
      reporterAvatar,
      reporterRole,
      type: type === 'flood' ? 'flash_flood' : (type || 'landslide'),
      description: description || 'Báo cáo sự cố khẩn cấp trên đường trek.',
      severity: (severity === 'critical' ? 'high' : (severity || 'high')) as any,
      locationNote: locationNote || `Khu vực: ${actualTrailName}`,
      coordinates: actualCoords,
      active: true,
      reportedAt: new Date().toLocaleDateString('vi-VN'),
      confirmations: 1,
      coReporters: [
        {
          userId: reportedById,
          userName: reporterName,
          userEmail: reporterEmail,
          userAvatar: reporterAvatar,
          confirmedAt: new Date().toLocaleString('vi-VN'),
          note: locationNote || 'Báo cáo khởi tạo',
        },
      ],
      timelineUpdates: [
        {
          id: `upd-${Date.now()}`,
          userId: reportedById,
          userName: reporterName,
          userEmail: reporterEmail,
          userAvatar: reporterAvatar,
          content: description || 'Báo cáo ban đầu.',
          statusNote: 'Khởi tạo cảnh báo',
          createdAt: new Date().toLocaleString('vi-VN'),
        },
      ],
      safetyReports: [],
    } as any);
  } catch (err) {
    console.warn('[MongoDB Incident Save Warning]:', err);
  }

  inMemoryIncidents.unshift(newIncident);

  // Broadcast realtime emergency alert via Socket.io
  broadcastEvent('emergencyAlert', {
    type: 'EMERGENCY_ALERT',
    incident: newIncident,
    message: `CẢNH BÁO NGUY HIỂM TẠI ${actualTrailName.toUpperCase()}: ${newIncident.description}`,
  });

  // Notify Admins
  notifyAdmins({
    sender: {
      id: reportedById || 'reporter',
      name: reporterName,
      avatarUrl: reporterAvatar,
    },
    type: 'safety_alert',
    title: `Cảnh báo nguy hiểm tại ${actualTrailName}`,
    message: `${reporterName} vừa phát cảnh báo: "${newIncident.description}"`,
    link: `/#trail/${newIncident.trailId || 'all'}`,
    relatedId: newIncident.id,
  }).catch(() => {});

  res.status(201).json({ success: true, message: 'Đã phát cảnh báo nguy hiểm thành công!', data: newIncident });
};

// POST /api/incidents/:id/confirm - Verify incident (True confirmation or False dispute)
export const confirmIncident = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action = 'confirm_true', note, additionalDescription, severity, reason } = req.body;
  const authUser = (req as any).user;

  const reporterName = req.body.reporterName || authUser?.fullName || authUser?.username || 'Trekker Thực Địa';
  const reporterEmail = req.body.reporterEmail || authUser?.email || '';
  const reporterAvatar = req.body.reporterAvatar || authUser?.avatarUrl || '';
  const reportedById = authUser?.userId || authUser?._id || authUser?.id || null;

  const foundMem = inMemoryIncidents.find((i) => i.id === id || (i as any)._id === id);

  if (action === 'dispute_false') {
    // 1. DISPUTE FALSE ALARM
    const disputeReason = note || additionalDescription || reason || 'Phản ánh thông tin cảnh báo không đúng thực tế.';
    if (foundMem) {
      if (!foundMem.disputes) foundMem.disputes = [];
      foundMem.disputes.push({
        userId: reportedById,
        userName: reporterName,
        userEmail: reporterEmail,
        disputedAt: 'Vừa xong',
        reason: disputeReason,
      });

      if (!foundMem.timelineUpdates) foundMem.timelineUpdates = [];
      foundMem.timelineUpdates.unshift({
        id: `upd-${Date.now()}`,
        userId: reportedById,
        userName: reporterName,
        userEmail: reporterEmail,
        userAvatar: reporterAvatar,
        content: `Phản ánh cảnh báo SAI SỰ THẬT: "${disputeReason}"`,
        statusNote: 'Khiếu nại báo động giả',
        createdAt: 'Vừa xong',
      });
    }

    try {
      const isMongoId = typeof id === 'string' && id.length === 24;
      const query = isMongoId ? { _id: id } : { $or: [{ id }, { _id: id }] };
      await IncidentModel.findOneAndUpdate(query as any, {
        $push: {
          disputes: {
            userId: reportedById,
            userName: reporterName,
            userEmail: reporterEmail,
            disputedAt: new Date().toLocaleString('vi-VN'),
            reason: disputeReason,
          },
          timelineUpdates: {
            id: `upd-${Date.now()}`,
            userId: reportedById,
            userName: reporterName,
            userEmail: reporterEmail,
            userAvatar: reporterAvatar,
            content: `Phản ánh cảnh báo SAI SỰ THẬT: "${disputeReason}"`,
            statusNote: 'Khiếu nại báo động giả',
            createdAt: new Date().toLocaleString('vi-VN'),
          },
        },
      });
    } catch (err) {}

    broadcastEvent('incidentDisputed', {
      incidentId: id,
      reporterName,
      reason: disputeReason,
    });

    // Notify Admins of False Alarm Dispute
    notifyAdmins({
      sender: {
        id: reportedById || 'disputer',
        name: reporterName,
        avatarUrl: reporterAvatar,
      },
      type: 'dispute_alert',
      title: `Khiếu nại tin giả tại ${foundMem?.trailName || 'Cung đường'}`,
      message: `Trekker ${reporterName} phản ánh cảnh báo sự cố là tin sai sự thật: "${disputeReason}".`,
      link: '/admin',
      relatedId: id,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Đã tiếp nhận phản ánh cảnh báo sai sự thật. Ban Quản Trị sẽ rà soát và xử phạt tài khoản vi phạm nếu có dấu hiệu tung tin giả!',
      data: foundMem,
    });
  }

  // 2. CONFIRM TRUE INCIDENT
  if (foundMem) {
    foundMem.confirmations = (foundMem.confirmations || 1) + 1;
    if (!foundMem.coReporters) foundMem.coReporters = [];
    foundMem.coReporters.push({
      userId: reportedById,
      userName: reporterName,
      userEmail: reporterEmail,
      userAvatar: reporterAvatar,
      confirmedAt: 'Vừa xong',
      note: note || additionalDescription || 'Đã xác nhận sự cố chính xác.',
    });

    if (additionalDescription || note) {
      if (!foundMem.timelineUpdates) foundMem.timelineUpdates = [];
      foundMem.timelineUpdates.unshift({
        id: `upd-${Date.now()}`,
        userId: reportedById,
        userName: reporterName,
        userEmail: reporterEmail,
        userAvatar: reporterAvatar,
        content: additionalDescription || note || 'Xác nhận thông tin chính xác.',
        statusNote: 'Xác nhận ĐÚNG & Bổ sung thông tin',
        createdAt: 'Vừa xong',
      });
    }

    if (severity) {
      foundMem.severity = severity;
    }
  }

  try {
    const isMongoId = typeof id === 'string' && id.length === 24;
    const query = isMongoId ? { _id: id } : { $or: [{ id }, { _id: id }] };
    await IncidentModel.findOneAndUpdate(query as any, {
      $inc: { confirmations: 1 },
      $push: {
        coReporters: {
          userId: reportedById,
          userName: reporterName,
          userEmail: reporterEmail,
          userAvatar: reporterAvatar,
          confirmedAt: new Date().toLocaleString('vi-VN'),
          note: note || additionalDescription || 'Đã xác nhận sự cố chính xác.',
        },
        ...(additionalDescription || note
          ? {
              timelineUpdates: {
                id: `upd-${Date.now()}`,
                userId: reportedById,
                userName: reporterName,
                userEmail: reporterEmail,
                userAvatar: reporterAvatar,
                content: additionalDescription || note || 'Xác nhận thông tin chính xác.',
                statusNote: 'Xác nhận ĐÚNG & Bổ sung thông tin',
                createdAt: new Date().toLocaleString('vi-VN'),
              },
            }
          : {}),
      },
      ...(severity ? { severity } : {}),
    });
  } catch (err) {
    console.warn('[MongoDB Confirm Update Warning]:', err);
  }

  broadcastEvent('incidentConfirmed', {
    incidentId: id,
    confirmations: foundMem?.confirmations || 2,
    latestUpdate: additionalDescription || note,
    reporterName,
  });

  return res.json({
    success: true,
    message: `Đã xác nhận thông tin đúng thành công! Sự cố hiện có ${foundMem?.confirmations || 2} Trekker cùng xác thực.`,
    data: foundMem,
  });
};

// PUT /api/incidents/:id/resolve - Mark incident resolved
export const resolveIncident = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const isMongoId = typeof id === 'string' && id.length === 24;
    const query = isMongoId ? { _id: id } : { $or: [{ id }, { _id: id }] };
    await IncidentModel.findOneAndUpdate(query as any, { active: false, resolved: true });
  } catch (e) {
    console.warn('[MongoDB Incident Resolve Warning]:', e);
  }

  const found = inMemoryIncidents.find((i) => i.id === id || (i as any)._id === id);
  if (found) {
    found.resolved = true;
    found.active = false;
  }

  inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id && (i as any)._id !== id);

  broadcastEvent('incidentResolved', { id });
  res.json({ success: true, message: 'Đã gỡ cảnh báo và đánh dấu xử lý sự cố thành công!' });
};

// DELETE /api/incidents/:id - Delete incident permanently
export const deleteIncident = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const isMongoId = typeof id === 'string' && id.length === 24;
    const query = isMongoId ? { _id: id } : { $or: [{ id }, { _id: id }] };
    await IncidentModel.findOneAndDelete(query as any);
  } catch (e) {
    console.warn('[MongoDB Incident Delete Warning]:', e);
  }

  inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id && (i as any)._id !== id);

  broadcastEvent('incidentResolved', { id });
  res.json({ success: true, message: 'Đã xóa sự cố thành công!' });
};

// PUT /api/admin/incidents/:id/dispute-resolve - Admin resolves false alarm dispute
export const resolveDisputeIncidentAdmin = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action } = req.body; // 'dismiss_incident' (dispute accepted, fake alarm removed) or 'reject_dispute' (dispute rejected, real danger)

  try {
    const isMongoId = typeof id === 'string' && id.length === 24;
    const query = isMongoId ? { _id: id } : { $or: [{ id }, { _id: id }] };

    if (action === 'dismiss_incident') {
      // Fake alarm confirmed: remove incident
      await IncidentModel.findOneAndDelete(query as any);
      inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id && (i as any)._id !== id);

      broadcastEvent('incidentResolved', { id });
      return res.json({
        success: true,
        message: 'Đã chấp thuận khiếu nại: Gỡ bỏ cảnh báo sai sự thật khỏi bản đồ!',
      });
    } else {
      // Incident is confirmed real hazard: clear disputes
      await IncidentModel.findOneAndUpdate(query as any, { $set: { disputes: [] } });
      const found = inMemoryIncidents.find((i) => i.id === id || (i as any)._id === id);
      if (found) found.disputes = [];

      return res.json({
        success: true,
        message: 'Đã bác bỏ khiếu nại: Cảnh báo sự cố là có thật và tiếp tục được duy trì trên bản đồ.',
      });
    }
  } catch (err) {
    console.error('[Resolve Dispute Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý khiếu nại sự cố.' });
  }
};
