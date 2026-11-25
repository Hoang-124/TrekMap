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
  'lost_custom_routes_v1',
  'lost_gear_optimizer_v1',
  'lost_training_plan_v1',
  'lost_topo_quiz_best_v1',
  'lost_survival_drills_v1',
  'lost_best_comment_v1',
  'lost_squad_safety_gate_v1',
  'lost_squad_gear_v1',
  'lost_local_itineraries',
  'lost_gemini_api_key',
  'lost_engine_mode',
];

const SENSITIVE_LOCAL_STORAGE_PREFIXES: readonly string[] = [
  'lost_itinerary_',
  'lost_checklist_',
  'lost_contrib_draft_',
];

const SENSITIVE_SESSION_STORAGE_KEYS: readonly string[] = [
  'lost_ai_pending_prompt',
  'lost_trip_budget_draft',
];

/**
 * Decodes either LOST's custom 2-part HMAC token (`${base64urlPayload}.${hexSignature}`)
 * or a standard 3-part JWT (`${header}.${payload}.${signature}`).
 */
export function decodeAccessTokenPayload(token?: string | null): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.trim().split('.');
    let rawSegment = '';
    if (parts.length === 2) {
      rawSegment = parts[0];
    } else if (parts.length === 3) {
      rawSegment = parts[1];
    } else {
      return null;
    }
    if (!rawSegment) return null;

    const base64 = rawSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    const binary = atob(padded);

    let decodedText = binary;
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      decodedText = new TextDecoder('utf-8').decode(bytes);
    }

    const parsed: unknown = JSON.parse(decodedText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwtPayloadUid(token: string): string {
  const payload = decodeAccessTokenPayload(token);
  if (!payload) return '';
  const raw = payload.userId ?? payload.id ?? payload._id ?? payload.sub;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
}

/**
 * Private-mode / quota-safe localStorage wrappers so Safari Private Browsing,
 * opaque-origin iframes, or exceeded storage quota never throw uncaught errors.
 */
export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the active authenticated user's ID from the stored JWT, or `'guest'`.
 */
export function getActiveStorageUid(explicitUid?: string | null): string {
  if (explicitUid && explicitUid.trim()) {
    return explicitUid.trim();
  }
  const token = safeLocalStorageGet('lost_token');
  if (!token) return 'guest';
  return decodeJwtPayloadUid(token) || 'guest';
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
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && SENSITIVE_LOCAL_STORAGE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        keysToRemove.push(k);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access restrictions
  }
  try {
    for (const key of SENSITIVE_SESSION_STORAGE_KEYS) {
      sessionStorage.removeItem(key);
    }
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && SENSITIVE_LOCAL_STORAGE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        sessionKeysToRemove.push(k);
      }
    }
    for (const key of sessionKeysToRemove) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  rotateClientSessionId();
}
