export interface Waypoint {
  id: string;
  name: string;
  type: 'campsite' | 'water' | 'viewpoint' | 'danger' | 'charging' | 'rest';
  description: string;
  elevationM?: number;
  lat: number;
  lng: number;
}

export interface Review {
  id: string;
  trailId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  difficultyRating: number;
  content: string;
  safetyNote?: string;
  photos?: string[];
  tripDate: string;
  createdAt: string;
}

export interface Guide {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  region: string;
  priceNote: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
}

export type LocalGuide = Guide;

export interface Trail {
  id: string;
  name: string;
  altNames?: string[];
  province: string;
  district: string;
  region: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  durationDays: number;
  durationHoursNote: string;
  difficultyLevel: number;
  difficultyNote: string;
  bestMonths: number[];
  avoidMonths: number[];
  gpxTrack: [number, number][];
  description: string;
  transportationInfo: string;
  permitRequired: boolean;
  permitInfo?: string;
  status: 'approved' | 'pending' | 'rejected';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  rating: number;
  reviewCount: number;
  coverImage: string;
  galleryImages?: string[];
  hasCampsite: boolean;
  hasWaterSource: boolean;
  kidFriendly: boolean;
  rescueContact: {
    name: string;
    phone: string;
    rangerContact: string;
  };
  waypoints: Waypoint[];
  reviews?: Review[];
  guides?: Guide[];
  distanceFromUserKm?: number;
  roadDistanceKm?: number;
  travelDurationFormatted?: string;
  travelDurationMin?: number;
}

export interface Incident {
  id: string;
  trailId: string;
  trailName: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  reportedBy?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterAvatar?: string;
  reporterRole?: string;
  type: 'landslide' | 'flash_flood' | 'lost' | 'bad_weather' | 'flood' | 'weather' | 'wildlife' | 'other';
  description: string;
  severity: 'high' | 'medium' | 'low' | 'critical';
  reportedAt: string;
  resolved: boolean;
  active?: boolean;
  locationNote?: string;
  images?: string[];
  verifiedBy?: string;
  verifiedAt?: string;
  coordinates?: { lat: number; lng: number };
  elevationM?: number;
  rescueContact?: string;
  confirmations?: number;
  coReporters?: Array<{
    userId?: any;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    confirmedAt: string;
    note?: string;
  }>;
  timelineUpdates?: Array<{
    id: string;
    userId?: any;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    content: string;
    statusNote?: string;
    createdAt: string;
  }>;
  disputes?: Array<{
    userId?: any;
    userName: string;
    userEmail?: string;
    disputedAt: string;
    reason: string;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: 'user' | 'guide' | 'admin' | 'trusted';
  reputationScore: number;
  badges: string[];
  checkedInTrails: string[];
  contributedTrails: string[];
}

export type User = UserProfile;

export interface ForumThread {
  id: string;
  title: string;
  authorName: string;
  authorAvatar?: string;
  category: 'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo';
  content: string;
  upvotes: number;
  repliesCount: number;
  viewsCount: number;
  createdAt: string;
  isPinned?: boolean;
}

export interface AiAssistantAction {
  type: 'trail_card' | 'emergency_sos' | 'gear_checklist' | 'quick_reply';
  trailId?: string;
  trailName?: string;
  trailData?: Partial<Trail>;
  emergencyContacts?: {
    name: string;
    phone: string;
    rangerContact?: string;
    region?: string;
    address?: string;
  }[];
  checklistItems?: {
    category: string;
    items: string[];
  }[];
  suggestions?: string[];
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: AiAssistantAction[];
  isError?: boolean;
}

