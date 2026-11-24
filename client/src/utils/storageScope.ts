import { rotateClientSessionId } from './sessionHeaders.js';

/**
 * Unscoped / legacy PII, AI, admin, and transient handoff keys that MUST be
 * wiped on logout, 401 eviction, or account ban so shared devices never leak
 * one trekker's private data into another account or guest session.
 */
const SENSITIVE_LOCAL_STORAGE_KEYS: readonly string[] = [
  'lost_contributions',
  'lost_ice_card_profile_v1',
  'lost_ai_threads_v2',
  'lost_guide_inquiries_v1',
  'lost_live_treks_v1',
  'lost_guest_body_weight_kg',
  'lost_cmdk_recent_v1',
  'lost_cover_url',
  'lost_editing_contribution',
  'lost_planner_draft_contribution',
  'lost_target_chat_user',
  'lost_target_group_conv',
];

const SENSITIVE_SESSION_STORAGE_KEYS: readonly string[] = [
  'lost_ai_pending_prompt',
  'lost_trip_budget_draft',
];

function decodeJwtPayloadUid(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return '';
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    const raw = payload.id ?? payload._id ?? payload.userId ?? payload.sub;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Returns the active authenticated user's ID from the stored JWT, or `'guest'`.
 */
export function getActiveStorageUid(explicitUid?: string | null): string {
  if (explicitUid && explicitUid.trim()) {
    return explicitUid.trim();
  }
  if (typeof window === 'undefined') return 'guest';
  try {
    const token = localStorage.getItem('lost_token');
    if (!token) return 'guest';
    return decodeJwtPayloadUid(token) || 'guest';
  } catch {
    return 'guest';
  }
}

/**
 * Builds a per-account scoped localStorage key: `${baseKey}_${uid || 'guest'}`.
 */
export function scopedStorageKey(baseKey: string, explicitUid?: string | null): string {
  return `${baseKey}_${getActiveStorageUid(explicitUid)}`;
}

/**
 * Wipes all sensitive legacy/unscoped localStorage & sessionStorage entries and
 * rotates `lost_client_session_id` so the next user or guest starts clean.
 */
export function clearSensitiveSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of SENSITIVE_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access restrictions
  }
  try {
    for (const key of SENSITIVE_SESSION_STORAGE_KEYS) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  rotateClientSessionId();
}
