import { Request, Response } from 'express';
import { mockIncidents } from '../data/seedData.js';
import { Incident } from '../types.js';

let incidents: Incident[] = [...mockIncidents];

export const getIncidents = (req: Request, res: Response) => {
  const activeIncidents = incidents.filter((i) => !i.resolved);
  res.json({ success: true, count: activeIncidents.length, data: activeIncidents });
};

export const createIncident = (req: Request, res: Response) => {
  const { trailId, type, description, severity, locationNote } = req.body;

  const newIncident: Incident = {
    id: `inc-${Date.now()}`,
    trailId: trailId || 'trail-fansipan',
    trailName: 'Cung đường Trekking',
    userName: 'Trekker Khẩn Cấp',
    type: type || 'landslide',
    description: description || 'Báo cáo sự cố khẩn cấp trên đường trek.',
    severity: severity || 'high',
    resolved: false,
    reportedAt: 'Vừa xong',
    locationNote: locationNote || 'Gần Waypoint 2',
  };

  incidents.unshift(newIncident);
  res.status(201).json({ success: true, message: 'Đã gửi báo cáo cứu hộ khẩn cấp!', data: newIncident });
};
