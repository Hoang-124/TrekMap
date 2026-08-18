import type { Trail, Incident, User, Review } from '../types.js';
import { mockTrails, mockIncidents, mockUsers } from '../data/seedData.js';
import { getApiHeaders } from '../utils/sessionHeaders.js';

const API_BASE = '/api';

export async function uploadImageToCloudinary(
  imageBase64: string,
  filename?: string,
  category: 'avatars' | 'trails' | 'forum' | 'reviews' = 'trails'
): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ imageBase64, filename, category }),
    });
    const json = await res.json();
    if (json.success && json.url) {
      return json.url;
    }
  } catch (err) {
    console.error('Cloudinary API upload error:', err);
  }
  return `https://res.cloudinary.com/dsxbuk4pe/image/upload/f_auto,q_auto,w_800/v1/trekmap/${category}/cover.jpg`;
}

export async function fetchTrails(params?: {
  region?: string;
  difficulty?: number;
  search?: string;
  duration?: number;
  season?: number;
  campsite?: boolean;
  kidFriendly?: boolean;
  sortBy?: string;
}): Promise<Trail[]> {
  let list: Trail[] = [];

  try {
    const query = new URLSearchParams();
    if (params?.region) query.append('region', params.region);
    if (params?.difficulty) query.append('difficulty', String(params.difficulty));
    if (params?.search) query.append('search', params.search);
    if (params?.duration) query.append('duration', String(params.duration));
    if (params?.campsite) query.append('campsite', 'true');
    if (params?.kidFriendly) query.append('kidFriendly', 'true');
    if (params?.sortBy) query.append('sortBy', params.sortBy);

    const res = await fetch(`${API_BASE}/trails?${query.toString()}`);
    if (res.ok) {
      const json = await res.json();
      list = json.data || [];
    } else {
      list = [...mockTrails];
    }
  } catch (err) {
    console.warn('API unreachable, using local seed fallback');
    list = [...mockTrails];
  }

  // Merge approved user contributions from MongoDB or localStorage
  try {
    let approvedContribs: any[] = [];
    const localContribs: any[] = JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
    approvedContribs = localContribs.filter((c: any) => c.status === 'approved');

    try {
      const mongoRes = await fetch(`${API_BASE}/contributions`);
      const mongoData = await mongoRes.json();
      if (mongoData.success && Array.isArray(mongoData.data)) {
        const mongoApproved = mongoData.data.filter((c: any) => c.status === 'approved');
        if (mongoApproved.length > 0) {
          approvedContribs = mongoApproved;
        }
      }
    } catch (e) {}

    const approvedTrails: Trail[] = approvedContribs.map((c: any) => ({
      id: c.id || `contrib-${c._id || Date.now()}`,
      name: c.name,
      altNames: c.altNames || [],
      region: c.region || 'Miền Bắc',
      province: c.province || 'Lào Cai',
      district: c.district || 'Sa Pa',
      hamlet: c.hamlet || '',
      distanceKm: Number(c.distanceKm) || 15,
      elevationGainM: Number(c.elevationGainM) || 800,
      maxAltitudeM: Number(c.maxAltitudeM) || 2000,
      durationDays: Math.ceil((Number(c.distanceKm) || 15) / 10),
      durationHoursNote: c.durationHoursNote || '1 ngày',
      difficultyLevel: Number(c.difficultyLevel) || 3,
      difficultyNote: (Number(c.difficultyLevel) || 3) >= 4 ? 'Thử thách cao' : 'Trung bình',
      bestMonths: Array.isArray(c.bestMonths) && c.bestMonths.length > 0 ? c.bestMonths : [10, 11, 12, 1, 2, 3, 4],
      avoidMonths: Array.isArray(c.avoidMonths) ? c.avoidMonths : [],
      bestSeasons: Array.isArray(c.bestMonths) && c.bestMonths.length > 0 ? c.bestMonths : [10, 11, 12, 1, 2, 3, 4],
      startLat: Number(c.startLat) || 22.3364,
      startLng: Number(c.startLng) || 103.8438,
      endLat: Number(c.endLat) || 22.3512,
      endLng: Number(c.endLng) || 103.864,
      description: c.description || 'Cung đường đã được Ban Quản Trị BQT kiểm duyệt và công khai.',
      transportationInfo: c.transportationInfo || '',
      coverImage: c.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [c.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'],
      permitRequired: !!c.permitRequired,
      permitInfo: c.permitInfo || '',
      hasCampsite: !!c.hasCampsite,
      hasWaterSource: !!c.hasWaterSource,
      kidFriendly: !!c.kidFriendly,
      gpxTrack: c.gpxTrack || [
        [Number(c.startLat) || 22.3364, Number(c.startLng) || 103.8438],
        [(Number(c.startLat) || 22.3364) + 0.005, (Number(c.startLng) || 103.8438) + 0.005],
        [Number(c.endLat) || 22.3512, Number(c.endLng) || 103.864],
      ],
      dangerWarnings: [],
      waypoints: [],
      status: 'approved',
      createdAt: c.createdAt || new Date().toLocaleDateString('vi-VN'),
      updatedAt: new Date().toLocaleDateString('vi-VN'),
      rescueContact: {
        name: 'Hạt Kiểm Lâm ' + (c.province || 'Địa phương'),
        phone: '114 / 115 (Cứu nạn & Cấp cứu 24/7)',
        rangerContact: 'Trạm Kiểm Lâm ' + (c.district || 'Cửa Rừng'),
      },
      rating: Number(c.rating) || 0,
      reviewCount: Number(c.reviewCount) || 0,
    }));

    const existingIds = new Set(list.map((t) => t.id));
    const newApproved = approvedTrails.filter((t) => !existingIds.has(t.id));
    list = [...newApproved, ...list];
  } catch (mergeErr) {
    console.warn('Error merging approved contributions:', mergeErr);
  }

  // Client-side Filter & Sort logic
  if (params?.region && params.region !== 'All') {
    list = list.filter((t) => (t?.region || '').toLowerCase() === params.region!.toLowerCase());
  }
  if (params?.difficulty) {
    list = list.filter((t) => t?.difficultyLevel === Number(params.difficulty));
  }
  if (params?.duration) {
    list = list.filter((t) => t?.durationDays === Number(params.duration));
  }
  if (params?.campsite) {
    list = list.filter((t) => !!t?.hasCampsite);
  }
  if (params?.kidFriendly) {
    list = list.filter((t) => !!t?.kidFriendly);
  }
  if (params?.search && typeof params.search === 'string' && params.search.trim().length > 0) {
    const q = params.search.trim().toLowerCase();
    list = list.filter(
      (t) =>
        (t?.name || '').toLowerCase().includes(q) ||
        (t?.province || '').toLowerCase().includes(q) ||
        (t?.district || '').toLowerCase().includes(q) ||
        (t?.region || '').toLowerCase().includes(q) ||
        (t?.description || '').toLowerCase().includes(q)
    );
  }

  if (params?.sortBy) {
    const s = params.sortBy;
    if (s === 'rating_desc' || s === 'rating') {
      list.sort((a, b) => (b?.rating || 0) - (a?.rating || 0));
    } else if (s === 'distance_asc') {
      list.sort((a, b) => (a?.distanceKm || 0) - (b?.distanceKm || 0));
    } else if (s === 'distance_desc') {
      list.sort((a, b) => (b?.distanceKm || 0) - (a?.distanceKm || 0));
    } else if (s === 'difficulty_asc') {
      list.sort((a, b) => (a?.difficultyLevel || 0) - (b?.difficultyLevel || 0));
    } else if (s === 'difficulty_desc') {
      list.sort((a, b) => (b?.difficultyLevel || 0) - (a?.difficultyLevel || 0));
    }
  }

  return list;
}

export async function fetchNearbyTrails(lat: number, lng: number, limit = 5): Promise<Trail[]> {
  try {
    const res = await fetch(`${API_BASE}/trails/nearby?lat=${lat}&lng=${lng}&limit=${limit}`);
    if (!res.ok) throw new Error('Spatial Query API error');
    const json = await res.json();
    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (err) {
    console.warn('Spatial Query API error, performing local Haversine distance calculation');
  }

  const R = 6371; // WGS84 Earth radius in km
  return mockTrails
    .map((t) => {
      const dLat = ((t.startLat - lat) * Math.PI) / 180;
      const dLon = ((t.startLng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) * Math.cos((t.startLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = Math.round(R * c * 10) / 10;
      const roadKm = Math.round(distKm * 1.8 * 10) / 10;
      const totalMinutes = Math.round((roadKm / 48) * 60);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const travelDurationFormatted = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}p` : ''}`.trim() : `${mins} phút`;

      return {
        ...t,
        distanceFromUserKm: distKm,
        roadDistanceKm: roadKm,
        travelDurationMin: totalMinutes,
        travelDurationFormatted,
      };
    })
    .sort((a, b) => ((a as any).distanceFromUserKm || 0) - ((b as any).distanceFromUserKm || 0))
    .slice(0, limit) as Trail[];
}

export async function fetchTrailById(id: string): Promise<Trail | null> {
  try {
    const res = await fetch(`${API_BASE}/trails/${id}`);
    if (!res.ok) throw new Error('Not found');
    const json = await res.json();
    return json.data;
  } catch (err) {
    return (mockTrails.find((t) => t.id === id) || mockTrails[0]) as Trail;
  }
}

export async function submitTrailContribution(trailData: Partial<Trail>): Promise<Trail> {
  try {
    const res = await fetch(`${API_BASE}/contributions`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(trailData),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Bạn không có quyền thực hiện thao tác này.');
    }
    return json.data;
  } catch (err) {
    console.log('Using local mock fallback for contribution');
    return {
      id: `trail-${Date.now()}`,
      name: trailData.name || 'Cung đường mới',
      province: trailData.province || 'Chưa cập nhật',
      district: trailData.district || 'Chưa cập nhật',
      region: trailData.region || 'Miền Bắc',
      startLat: trailData.startLat || 21.0,
      startLng: trailData.startLng || 105.0,
      endLat: 21.01,
      endLng: 105.01,
      distanceKm: trailData.distanceKm || 10,
      elevationGainM: trailData.elevationGainM || 500,
      maxAltitudeM: trailData.maxAltitudeM || 1500,
      durationDays: trailData.durationDays || 2,
      durationHoursNote: '2 ngày 1 đêm',
      difficultyLevel: trailData.difficultyLevel || 3,
      difficultyNote: 'Cần thể lực tốt',
      bestMonths: [10, 11, 12, 1, 2, 3],
      avoidMonths: [7, 8],
      gpxTrack: trailData.gpxTrack || [[21.0, 105.0]],
      description: trailData.description || 'Mô tả chi tiết đang được duyệt.',
      transportationInfo: trailData.transportationInfo || 'Di chuyển bằng xe máy hoặc xe khách.',
      permitRequired: false,
      status: 'pending',
      createdBy: 'user-1',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      rating: 0,
      reviewCount: 0,
      coverImage: trailData.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
      rescueContact: { name: 'Cứu hộ 114', phone: '114', rangerContact: '115' },
      hasCampsite: true,
      hasWaterSource: true,
      kidFriendly: false,
      waypoints: trailData.waypoints || [],
    };
  }
}

export async function submitReview(trailId: string, reviewData: Partial<Review>): Promise<Review> {
  try {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...reviewData, trailId }),
    });
    const json = await res.json();
    return json.data;
  } catch (err) {
    return {
      id: `rev-${Date.now()}`,
      trailId,
      userId: 'user-1',
      userName: 'MinhTrekker (Verified)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      rating: reviewData.rating || 5,
      difficultyRating: reviewData.difficultyRating || 3,
      safetyNote: reviewData.safetyNote || '',
      content: reviewData.content || 'Trải nghiệm tuyệt vời!',
      tripDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
    };
  }
}

export async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch(`${API_BASE}/incidents`);
    const json = await res.json();
    return json.data;
  } catch (err) {
    return mockIncidents as Incident[];
  }
}

export async function submitIncident(incidentData: Partial<Incident>): Promise<Incident> {
  try {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(incidentData),
    });
    const json = await res.json();
    return json.data;
  } catch (err) {
    return {
      id: `inc-${Date.now()}`,
      trailId: incidentData.trailId || 'trail-fansipan',
      trailName: incidentData.trailName || 'Tuyến đường Cảnh Báo',
      userId: 'user-1',
      userName: 'Trekker Cứu Hộ',
      type: incidentData.type || 'weather',
      description: incidentData.description || 'Cảnh báo thời tiết xấu.',
      severity: incidentData.severity || 'high',
      reportedAt: new Date().toLocaleString('vi-VN'),
      resolved: false,
      locationNote: incidentData.locationNote || '',
    };
  }
}

export async function confirmIncidentApi(
  incidentId: string,
  payload: {
    action?: 'confirm_true' | 'dispute_false';
    note?: string;
    additionalDescription?: string;
    severity?: string;
    reason?: string;
    reporterName?: string;
    reporterEmail?: string;
    reporterAvatar?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/confirm`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchUserProfile(userId: string): Promise<User> {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}`);
    const json = await res.json();
    return json.data;
  } catch (err) {
    return mockUsers[0] as User;
  }
}

export async function fetchWeatherForecast(trailId: string) {
  try {
    const res = await fetch(`${API_BASE}/weather/${trailId}`);
    if (!res.ok) throw new Error('Weather API error');
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('Weather API fallback used:', err);
    const today = new Date();
    const mockData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return {
        forecastDate: d.toISOString().split('T')[0],
        tempMinC: 12 + i,
        tempMaxC: 19 + i,
        humidityPercent: 75,
        windSpeedKmH: 15,
        cloudCoverPercent: 40,
        seaOfCloudsIndex: 78,
        weatherCondition: i === 0 ? 'clear' : i % 2 === 0 ? 'cloudy' : 'foggy',
      };
    });
    return {
      success: true,
      data: mockData,
      hasWarning: false,
      warningMessage: null,
    };
  }
}

export async function createExpeditionItinerary(itineraryData: any) {
  try {
    const res = await fetch(`${API_BASE}/itineraries`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(itineraryData),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('Itinerary API fallback used:', err);
    const shareToken = `trek-${Math.random().toString(36).substring(2, 9)}`;
    return {
      success: true,
      data: {
        ...itineraryData,
        shareToken,
      },
      shareUrl: `http://localhost:5173/itinerary/${shareToken}`,
    };
  }
}

export async function fetchItineraryByToken(shareToken: string) {
  try {
    const res = await fetch(`${API_BASE}/itineraries/share/${shareToken}`);
    if (!res.ok) throw new Error('Itinerary not found');
    const json = await res.json();
    return json.data;
  } catch (err) {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(`${API_BASE}/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error('Geocoding API error');
    const json = await res.json();
    return json.data;
  } catch (err) {
    return {
      formattedAddress: `Tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      province: 'Việt Nam',
      district: 'Khu vực núi',
    };
  }
}

// Notification API Services
export async function fetchNotificationsApi(params?: { category?: string; page?: number; limit?: number }) {
  try {
    const token = localStorage.getItem('trekmap_token');
    if (!token) return { success: false, data: [], unreadCount: 0 };

    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.append('category', params.category);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/notifications?${query.toString()}`, {
      headers: getApiHeaders({ Authorization: `Bearer ${token}` }),
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return await res.json();
  } catch (err) {
    return { success: false, data: [], unreadCount: 0 };
  }
}

export async function markNotificationReadApi(id: string) {
  try {
    const token = localStorage.getItem('trekmap_token');
    if (!token) return { success: false };

    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: getApiHeaders({ Authorization: `Bearer ${token}` }),
    });
    return await res.json();
  } catch (err) {
    return { success: false };
  }
}

export async function markAllNotificationsReadApi(category?: string) {
  try {
    const token = localStorage.getItem('trekmap_token');
    if (!token) return { success: false };

    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getApiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ category }),
    });
    return await res.json();
  } catch (err) {
    return { success: false };
  }
}

export async function deleteNotificationApi(id: string) {
  try {
    const token = localStorage.getItem('trekmap_token');
    if (!token) return { success: false };

    const res = await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      headers: getApiHeaders({ Authorization: `Bearer ${token}` }),
    });
    return await res.json();
  } catch (err) {
    return { success: false };
  }
}

export async function clearReadNotificationsApi() {
  try {
    const token = localStorage.getItem('trekmap_token');
    if (!token) return { success: false };

    const res = await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: getApiHeaders({ Authorization: `Bearer ${token}` }),
    });
    return await res.json();
  } catch (err) {
    return { success: false };
  }
}



