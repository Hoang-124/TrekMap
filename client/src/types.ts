export type Region = 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';

export interface Waypoint {
  id: string;
  name: string;
  type: 'campsite' | 'water' | 'viewpoint' | 'danger' | 'charging' | 'rest';
  description: string;
  elevationM?: number;
  lat: number;
  lng: number;
  trailId?: string;
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
  reviewCount?: number;
  verified: boolean;
}

export type LocalGuide = Guide;

export interface Trail {
  id: string;
  name: string;
  altNames?: string[];
  province: string;
  district: string;
  region: Region;
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
  status: 'approved' | 'pending' | 'rejected' | 'published';
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
}

export interface Incident {
  id: string;
  trailId: string;
  trailName: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  type: 'landslide' | 'flash_flood' | 'lost' | 'bad_weather' | 'flood' | 'weather' | 'wildlife' | 'other';
  description: string;
  severity: 'high' | 'medium' | 'low' | 'critical';
  reportedAt: string;
  resolved: boolean;
  locationNote?: string;
  images?: string[];
  verifiedBy?: string;
  verifiedAt?: string;
  coordinates?: { lat: number; lng: number };
  elevationM?: number;
  rescueContact?: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  fullName: string;
  name?: string;
  avatarUrl: string;
  avatar?: string;
  role: 'user' | 'guide' | 'admin' | 'trusted';
  reputationScore: number;
  badges: string[];
  checkedInTrails: string[];
  contributedTrails: string[];
  contributedTrailsCount?: number;
  joinedAt?: string;
  phone?: string;
  bio?: string;
  emergencyContact?: string;
  preferredStyle?: string;
  gearLocker?: string[];
  authProvider?: string;
  isEmailVerified?: boolean;
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
  reactions?: Record<string, number>;
  userReaction?: string | null;
  repliesCount: number;
  viewsCount: number;
  createdAt: string;
  isPinned?: boolean;
}

export interface ConversationParticipant {
  _id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  email: string;
  role?: string;
}

export interface Conversation {
  _id: string;
  participants: ConversationParticipant[];
  otherParticipant?: ConversationParticipant;
  lastMessage?: {
    content: string;
    sender: ConversationParticipant | string;
    createdAt: string;
  };
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: ConversationParticipant;
  content: string;
  readBy: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface WeatherForecastDay {
  forecastDate: string;
  tempMinC: number;
  tempMaxC: number;
  humidityPercent: number;
  windSpeedKmH: number;
  cloudCoverPercent: number;
  seaOfCloudsIndex: number;
  weatherCondition: 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'storm';
}

export interface WeatherForecastResponse {
  success: boolean;
  data: WeatherForecastDay[];
  hasWarning: boolean;
  warningMessage?: string | null;
}

export interface ItineraryStep {
  day: number;
  time: string;
  title: string;
  description: string;
  locationNote?: string;
}

export interface ItineraryData {
  _id?: string;
  id?: string;
  creatorId?: string;
  trailId: string;
  title: string;
  startDate: string;
  endDate?: string;
  memberCount: number;
  timelineSteps: ItineraryStep[];
  shareToken?: string;
  status?: string;
}

export type NotificationType =
  | 'new_contribution_pending'
  | 'contribution_approved'
  | 'contribution_rejected'
  | 'new_message'
  | 'comment'
  | 'reaction'
  | 'system'
  | 'weather_alert';

export interface NotificationItem {
  _id: string;
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

