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

const REFRESH_EXCLUDED_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/google',
  '/api/auth/verify-code',
]);

const INTERCEPTOR_INSTALLED_KEY = '__lostAuthFetchInterceptorInstalled';

type WindowWithInterceptorFlag = Window & {
  [INTERCEPTOR_INSTALLED_KEY]?: boolean;
};

let inflightRefreshPromise: Promise<string | null> | null = null;

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') {
      return new URL(input, window.location.origin);
    }
    if (input instanceof URL) {
      return input;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, window.location.origin);
    }
  } catch {
    return null;
  }
  return null;
}

function extractAuthorizationHeader(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (init?.headers) {
    try {
      const initHeaders = new Headers(init.headers);
      const auth = initHeaders.get('authorization');
      if (auth) return auth;
    } catch {
      // ignore malformed headers
    }
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.headers.get('authorization');
  }
  return null;
}

function buildRetryRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  clonedRequest: Request | null,
  freshToken: string
): { retryInput: RequestInfo | URL; retryInit?: RequestInit } {
  if (clonedRequest) {
    const mergedHeaders = new Headers(clonedRequest.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        mergedHeaders.set(key, value);
      });
    }
    mergedHeaders.set('Authorization', `Bearer ${freshToken}`);
    const retryReq = new Request(clonedRequest, {
      ...init,
      headers: mergedHeaders,
    });
    return { retryInput: retryReq };
  }

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set('Authorization', `Bearer ${freshToken}`);
  return {
    retryInput: input,
    retryInit: {
      ...init,
      headers: retryHeaders,
    },
  };
}

/**
 * Installs a single idempotent `window.fetch` interceptor that transparently refreshes
 * expired access tokens on mid-session 401 responses for same-origin `/api/` calls
 * carrying a Bearer token, deduplicating concurrent refresh attempts.
 */
export function installAuthFetchInterceptor(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const win = window as WindowWithInterceptorFlag;
  if (win[INTERCEPTOR_INSTALLED_KEY]) return;
  win[INTERCEPTOR_INSTALLED_KEY] = true;

  const rawFetch = window.fetch.bind(window);

  const performDeduplicatedRefresh = (): Promise<string | null> => {
    if (inflightRefreshPromise) return inflightRefreshPromise;

    inflightRefreshPromise = (async () => {
      try {
        const refreshRes = await rawFetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Client-Session-Id': getClientSessionId(),
          },
        });
        if (!refreshRes.ok) return null;

        const data = (await refreshRes.json().catch(() => null)) as {
          success?: boolean;
          token?: string;
          user?: unknown;
        } | null;

        if (data?.success && typeof data.token === 'string' && data.token.trim()) {
          const freshToken = data.token.trim();
          try {
            localStorage.setItem('lost_token', freshToken);
          } catch {
            // Ignore storage restrictions
          }
          window.dispatchEvent(
            new CustomEvent('lost:auth-changed', {
              detail: {
                authenticated: true,
                ...(data.user ? { user: data.user } : {}),
              },
            })
          );
          return freshToken;
        }
        return null;
      } catch {
        return null;
      }
    })().finally(() => {
      inflightRefreshPromise = null;
    });

    return inflightRefreshPromise;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const resolvedUrl = resolveRequestUrl(input);
    const isSameOriginApi =
      Boolean(resolvedUrl) &&
      resolvedUrl!.origin === window.location.origin &&
      resolvedUrl!.pathname.startsWith('/api/') &&
      !REFRESH_EXCLUDED_PATHS.has(resolvedUrl!.pathname);

    if (!isSameOriginApi) {
      return rawFetch(input, init);
    }

    const authHeader = extractAuthorizationHeader(input, init);
    if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader.trim())) {
      return rawFetch(input, init);
    }

    const originalToken = authHeader.trim().replace(/^Bearer\s+/i, '');

    let clonedRequest: Request | null = null;
    if (typeof Request !== 'undefined' && input instanceof Request) {
      try {
        clonedRequest = input.clone();
      } catch {
        clonedRequest = null;
      }
    }

    const initialResponse = await rawFetch(input, init);
    if (initialResponse.status !== 401 || init?.signal?.aborted) {
      return initialResponse;
    }

    // If another concurrent request already rotated `lost_token`, reuse it without double-refreshing
    let storedToken: string | null;
    try {
      storedToken = localStorage.getItem('lost_token');
    } catch {
      storedToken = null;
    }

    const freshToken =
      storedToken && storedToken.trim() && storedToken.trim() !== originalToken
        ? storedToken.trim()
        : await performDeduplicatedRefresh();

    if (!freshToken || freshToken === originalToken || init?.signal?.aborted) {
      return initialResponse;
    }

    const { retryInput, retryInit } = buildRetryRequest(input, init, clonedRequest, freshToken);
    return rawFetch(retryInput, retryInit);
  };
}
