import { Request, Response } from 'express';
import { reverseGeocodeLocation } from '../services/publicApis.service.js';

export const handleReverseGeocode = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    if (lat === undefined || lng === undefined || lat === '' || lng === '') {
      return res.status(400).json({ success: false, message: 'Thiếu tọa độ lat & lng.' });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return res.status(400).json({ success: false, message: 'Tọa độ lat/lng không hợp lệ.' });
    }

    const geoResult = await reverseGeocodeLocation(latNum, lngNum);

    if (geoResult) {
      return res.json({ success: true, data: geoResult });
    }

    return res.json({
      success: true,
      data: {
        formattedAddress: `Tọa độ (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`,
        province: 'Việt Nam',
        district: 'Khu vực núi',
        village: '',
      },
    });
  } catch (err) {
    console.error('[Reverse Geocode Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi giải mã tọa độ.' });
  }
};
