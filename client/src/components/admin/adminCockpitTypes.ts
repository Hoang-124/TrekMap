export type AdminCockpitSectionId =
  | 'overview'
  | 'contributions'
  | 'trails'
  | 'incidents'
  | 'inquiries'
  | 'safety'
  | 'field'
  | 'users'
  | 'forum'
  | 'stats'
  | 'audit';

export type VietnamSectorId = 'all' | 'north' | 'central' | 'south';

export interface CockpitTrailPoint {
  id: string;
  name: string;
  province: string;
  district?: string;
  region: string;
  startLat: number;
  startLng: number;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  difficultyLevel?: number;
  durationHoursNote?: string;
  rating?: number;
  reviewCount?: number;
  coverImage?: string;
  permitRequired?: boolean;
  permitInfo?: string;
  hasCampsite?: boolean;
  hasWaterSource?: boolean;
  kidFriendly?: boolean;
  status?: string;
}

export interface CockpitIncidentPoint {
  id: string;
  trailName: string;
  type?: string;
  severity: string;
  description: string;
  locationNote?: string;
  resolved: boolean;
  isSynthetic: boolean;
  lat?: number;
  lng?: number;
  reporterName?: string;
  reportedAt?: string;
  disputesCount: number;
}

export interface CockpitBeaconPoint {
  id: string;
  token: string;
  displayName: string;
  trailName: string;
  status: 'active' | 'sos' | 'ended';
  lat?: number;
  lng?: number;
  altitudeM?: number | null;
  batteryPercent?: number | null;
  distanceKm?: number;
  lastPingAt?: string;
  isSignalStale?: boolean;
  minutesSinceLastPing?: number | null;
  emergencyNote?: string;
  phone?: string;
  email?: string;
  emergencyContact?: string;
  sharePath: string;
}

export interface CockpitContributionPoint {
  id: string;
  name: string;
  province: string;
  district?: string;
  region?: string;
  status: string;
  distanceKm?: number;
  elevationGainM?: number;
  maxAltitudeM?: number;
  durationHoursNote?: string;
  startLat?: number;
  startLng?: number;
  coverImage?: string;
  authorName?: string;
  authorEmail?: string;
  createdAt?: string;
  permitRequired?: boolean;
  hasCampsite?: boolean;
  hasWaterSource?: boolean;
}

export interface CockpitUserPoint {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  reputationScore: number;
  badges: string[];
  isBanned: boolean;
  banReason?: string;
}

export type CockpitInspectorSelection =
  | { kind: 'trail'; data: CockpitTrailPoint }
  | { kind: 'contribution'; data: CockpitContributionPoint }
  | { kind: 'incident'; data: CockpitIncidentPoint }
  | { kind: 'beacon'; data: CockpitBeaconPoint }
  | { kind: 'user'; data: CockpitUserPoint };

export interface CockpitTriageItem {
  id: string;
  kind: 'sos' | 'overdue' | 'dispute' | 'incident' | 'contribution' | 'inquiry';
  priority: 1 | 2 | 3;
  title: string;
  subtitle: string;
  meta: string;
  targetSection: AdminCockpitSectionId;
  lat?: number;
  lng?: number;
  selection?: CockpitInspectorSelection;
}
