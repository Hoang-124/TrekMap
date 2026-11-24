import type { HubViewId } from '../types.js';

export type { HubViewId };

export const HUB_VIEW_IDS: readonly HubViewId[] = [
  'passport',
  'almanac',
  'planner',
  'toolkit',
  'directory',
  'training',
  'gear',
  'radar',
] as const;

export const HUB_PRESERVED_QUERY_KEYS = ['trailId', 'route', 'pack', 'tab', 'q', 'verify'] as const;
export type HubQueryParamKey = (typeof HUB_PRESERVED_QUERY_KEYS)[number];
export type HubQueryParams = Partial<Record<HubQueryParamKey, string>>;

export type AppView =
  | 'home'
  | 'explore'
  | 'detail'
  | 'contribute'
  | 'profile'
  | 'forum'
  | 'admin'
  | 'messages'
  | 'notifications'
  | 'beacon'
  | HubViewId;

export interface ResolvedAppRoute {
  view: AppView;
  trailId?: string;
  beaconToken?: string;
  queryParams?: HubQueryParams;
  publicProfileUsername?: string;
  sharedItineraryToken?: string;
  authModal?: 'login' | 'register';
  isProtected: boolean;
}

const HUB_VIEW_SET = new Set<string>(HUB_VIEW_IDS);
const PROTECTED_VIEWS = new Set<AppView>(['contribute', 'profile', 'admin', 'messages', 'notifications']);
const NAMED_VIEWS = new Set<AppView>([
  'explore',
  'profile',
  'admin',
  'contribute',
  'messages',
  'notifications',
  'forum',
  ...HUB_VIEW_IDS,
]);

const HASH_ALIASES: Record<string, AppView> = {
  challenges: 'passport',
  hub: 'passport',
  route: 'planner',
  survival: 'toolkit',
  rangers: 'directory',
  guides: 'directory',
  safety: 'radar',
};

export function isHubView(view: string): view is HubViewId {
  return HUB_VIEW_SET.has(view);
}

export function extractHubQueryParams(search?: string): HubQueryParams {
  const raw =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  const result: HubQueryParams = {};
  if (!raw) return result;
  try {
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
    for (const key of HUB_PRESERVED_QUERY_KEYS) {
      const val = params.get(key)?.trim();
      if (val) result[key] = val;
    }
  } catch {
    // ignore malformed query strings
  }
  return result;
}

/**
 * Single source of truth for resolving LOST URL pathname + hash + query into application view state.
 */
export function resolveAppRoute(path: string, hash: string, search?: string): ResolvedAppRoute {
  const rawHash = (hash || '').trim();
  const [cleanHashPath, hashQuery] = rawHash.split('?');
  const cleanHash = cleanHashPath || '';
  const cleanPath = (path || '/').replace(/^\/+/, '').replace(/\/+$/, '');
  const mergedParams: HubQueryParams = {
    ...extractHubQueryParams(hashQuery ? `?${hashQuery}` : ''),
    ...extractHubQueryParams(search),
  };
  const hasHubParams = Object.keys(mergedParams).length > 0;
  const queryTrailId = mergedParams.trailId;

  // Auth modal hash anchors (preserve underlying view & query params unless path specifies one)
  if (cleanHash === '#login' || cleanHash === '#register') {
    const baseView = NAMED_VIEWS.has(cleanPath as AppView) ? (cleanPath as AppView) : 'home';
    return {
      view: baseView,
      trailId: isHubView(baseView) ? queryTrailId : undefined,
      queryParams: isHubView(baseView) && hasHubParams ? mergedParams : undefined,
      authModal: cleanHash === '#login' ? 'login' : 'register',
      isProtected: PROTECTED_VIEWS.has(baseView),
    };
  }

  // Shared expedition itinerary deep-link
  if (cleanHash.startsWith('#itinerary/')) {
    const token = decodeURIComponent(cleanHash.slice('#itinerary/'.length));
    return {
      view: 'home',
      sharedItineraryToken: token || undefined,
      isProtected: false,
    };
  }

  // Public live family GPS beacon viewer (/beacon/:token or #beacon/:token)
  if (cleanPath.startsWith('beacon/')) {
    const token = decodeURIComponent(cleanPath.slice('beacon/'.length).split('/')[0] || '').trim();
    if (token) {
      return {
        view: 'beacon',
        beaconToken: token,
        isProtected: false,
      };
    }
  }
  if (cleanHash.startsWith('#beacon/')) {
    const token = decodeURIComponent(cleanHash.slice('#beacon/'.length).split('/')[0] || '').trim();
    if (token) {
      return {
        view: 'beacon',
        beaconToken: token,
        isProtected: false,
      };
    }
  }

  // Public trekker profile modal deep-link (#profile-<username> or /profile/:username)
  if (cleanHash.startsWith('#profile-')) {
    const username = decodeURIComponent(cleanHash.slice('#profile-'.length)).trim();
    if (username) {
      const baseView = NAMED_VIEWS.has(cleanPath as AppView) ? (cleanPath as AppView) : 'home';
      return {
        view: baseView === 'profile' ? 'home' : baseView,
        publicProfileUsername: username,
        isProtected: false,
      };
    }
  }
  if (cleanPath.startsWith('profile/')) {
    const username = decodeURIComponent(cleanPath.slice('profile/'.length).split('/')[0] || '').trim();
    if (username) {
      return {
        view: 'home',
        publicProfileUsername: username,
        isProtected: false,
      };
    }
  }

  // Path-based trail detail (/trails/:slug or /trail/:slug)
  if (cleanPath.startsWith('trails/')) {
    const slug = decodeURIComponent(cleanPath.slice('trails/'.length).split('/')[0] || '');
    if (slug) {
      return { view: 'detail', trailId: slug, isProtected: false };
    }
  }
  if (cleanPath.startsWith('trail/')) {
    const slug = decodeURIComponent(cleanPath.slice('trail/'.length).split('/')[0] || '');
    if (slug) {
      return { view: 'detail', trailId: slug, isProtected: false };
    }
  }

  // Hash-based trail detail (#trail/:id or legacy #trail-:slug)
  if (cleanHash.startsWith('#trail/')) {
    const slug = decodeURIComponent(cleanHash.slice('#trail/'.length));
    if (slug) {
      return { view: 'detail', trailId: slug, isProtected: false };
    }
  }
  if (cleanHash.startsWith('#trail-')) {
    const slug = decodeURIComponent(cleanHash.slice('#trail-'.length));
    if (slug) {
      return { view: 'detail', trailId: slug, isProtected: false };
    }
  }

  // Hash-based named views & Hub aliases take precedence when navigating via anchor links
  if (cleanHash.startsWith('#')) {
    const rawKey = cleanHash.slice(1).toLowerCase();
    const mappedView = (HASH_ALIASES[rawKey] || rawKey) as AppView;
    if (NAMED_VIEWS.has(mappedView)) {
      return {
        view: mappedView,
        trailId: isHubView(mappedView) ? queryTrailId : undefined,
        queryParams: isHubView(mappedView) && hasHubParams ? mergedParams : undefined,
        isProtected: PROTECTED_VIEWS.has(mappedView),
      };
    }
  }

  // Path-based /hub/<subview> aliases (e.g. /hub/passport, /hub/planner, /hub/gear)
  const lowerPath = cleanPath.toLowerCase();
  if (lowerPath.startsWith('hub/')) {
    const subKey = lowerPath.slice('hub/'.length).split('/')[0] || '';
    const mappedHubView = (HASH_ALIASES[subKey] || subKey) as AppView;
    if (NAMED_VIEWS.has(mappedHubView)) {
      return {
        view: mappedHubView,
        trailId: isHubView(mappedHubView) ? queryTrailId : undefined,
        queryParams: isHubView(mappedHubView) && hasHubParams ? mergedParams : undefined,
        isProtected: PROTECTED_VIEWS.has(mappedHubView),
      };
    }
  }

  // Path-based named views (/explore, /forum, /profile, /admin, /contribute, /messages, /notifications, and all 8 hubs)
  const mappedPathView = (HASH_ALIASES[lowerPath] || lowerPath) as AppView;
  if (NAMED_VIEWS.has(mappedPathView)) {
    return {
      view: mappedPathView,
      trailId: isHubView(mappedPathView) ? queryTrailId : undefined,
      queryParams: isHubView(mappedPathView) && hasHubParams ? mergedParams : undefined,
      isProtected: PROTECTED_VIEWS.has(mappedPathView),
    };
  }

  return { view: 'home', isProtected: false };
}

/**
 * Build a clean History API URL path for SEO and shareable deep links.
 * Preserves hub query parameters (`trailId`, `route`, `pack`, `tab`, `q`).
 */
export function buildCleanUrl(
  view: AppView,
  trailId?: string | null,
  extraParams?: HubQueryParams | null
): string {
  if (view === 'detail' && trailId) {
    return `/trails/${encodeURIComponent(trailId)}`;
  }
  if (view === 'beacon' && trailId) {
    return `/beacon/${encodeURIComponent(trailId)}`;
  }
  if (isHubView(view)) {
    const qs = new URLSearchParams();
    const merged: HubQueryParams = {
      ...(extraParams || {}),
      ...(trailId ? { trailId } : {}),
    };
    for (const key of HUB_PRESERVED_QUERY_KEYS) {
      const val = merged[key]?.trim();
      if (val) qs.set(key, val);
    }
    const serialized = qs.toString();
    return serialized ? `/${view}?${serialized}` : `/${view}`;
  }
  if (view === 'home') return '/';
  return `/${view}`;
}

export interface DocumentSeoMeta {
  title: string;
  description: string;
  image?: string;
  path?: string;
}

/**
 * Dynamically update <title> and OpenGraph/Meta tags when navigating between trails and views.
 */
export function updateDocumentSeoMeta(meta: DocumentSeoMeta): void {
  if (typeof document === 'undefined') return;
  document.title = meta.title;

  const upsertMeta = (selector: string, attrName: 'name' | 'property', key: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  upsertMeta('meta[name="description"]', 'name', 'description', meta.description);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  if (meta.image) {
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', meta.image);
  }
  if (meta.path && typeof window !== 'undefined') {
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', `${window.location.origin}${meta.path}`);
  }
}
