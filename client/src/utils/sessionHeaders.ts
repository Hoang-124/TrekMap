// One-time silent storage migration from legacy prefix so existing sessions stay logged in
const LEGACY_KEYS: Array<[string, string]> = [
  ['trekmap_token', 'lost_token'],
  ['trekmap_saved_email', 'lost_saved_email'],
  ['trekmap_remember_email', 'lost_remember_email'],
  ['trekmap_contributions', 'lost_contributions'],
  ['trekmap_client_session_id', 'lost_client_session_id'],
];

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    for (const [oldKey, newKey] of LEGACY_KEYS) {
      const legacyVal = localStorage.getItem(oldKey);
      if (legacyVal && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, legacyVal);
      }
      if (legacyVal !== null) {
        localStorage.removeItem(oldKey);
      }
    }
    // Remove orphaned legacy cover key that is no longer read (now scoped per-user as lost_cover_url_${uid})
    localStorage.removeItem('trekmap_cover_url');
    localStorage.removeItem('lost_cover_url');
  } catch {
    // Ignore storage access restrictions
  }
}

const generateClientSessionId = (): string =>
  'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

export const rotateClientSessionId = (): string => {
  const sid = generateClientSessionId();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lost_client_session_id', sid);
    }
  } catch {
    // Ignore storage access restrictions
  }
  return sid;
};

export const getClientSessionId = (): string => {
  try {
    let sid = localStorage.getItem('lost_client_session_id');
    if (!sid) {
      sid = generateClientSessionId();
      localStorage.setItem('lost_client_session_id', sid);
    }
    return sid;
  } catch {
    return generateClientSessionId();
  }
};

export const getApiHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-Client-Session-Id': getClientSessionId(),
    ...extraHeaders,
  };
  try {
    const token = localStorage.getItem('lost_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return headers;
};

export const notifyForumUpdated = (payload?: unknown) => {
  window.dispatchEvent(new CustomEvent('lost:forum-updated', { detail: payload }));
};
