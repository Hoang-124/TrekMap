import { describe, it, expect } from 'vitest';

/**
 * Route resolution helper derived from TrekMap App routing logic
 */
export function resolveAppRoute(path: string, hash: string): {
  view: string;
  trailId?: string;
  tab?: string;
  isProtected?: boolean;
  sharedItineraryToken?: string;
} {
  const protectedViews = ['contribute', 'profile', 'admin', 'messages', 'notifications'];

  // 1. Check hash matches
  if (hash.startsWith('#itinerary/')) {
    const token = hash.replace('#itinerary/', '');
    return { view: 'home', sharedItineraryToken: token };
  }

  // 2. Check path matches
  if (path.startsWith('/trail/')) {
    const slug = path.replace('/trail/', '').split('/')[0];
    return { view: 'detail', trailId: slug };
  }

  const cleanPath = path.replace(/^\//, '');
  if (cleanPath && ['explore', 'profile', 'admin', 'contribute', 'messages', 'notifications', 'forum'].includes(cleanPath)) {
    return {
      view: cleanPath,
      isProtected: protectedViews.includes(cleanPath),
    };
  }

  // 3. Check hash matches
  if (hash.startsWith('#trail-') || hash.startsWith('#trail/')) {
    const slug = hash.replace('#trail-', '').replace('#trail/', '');
    return { view: 'detail', trailId: slug };
  }
  if (hash === '#explore') return { view: 'explore' };
  if (hash === '#forum') return { view: 'forum' };
  if (hash === '#messages') return { view: 'messages', isProtected: true };
  if (hash === '#notifications') return { view: 'notifications', isProtected: true };
  if (hash === '#admin') return { view: 'admin', isProtected: true };
  if (hash === '#profile') return { view: 'profile', isProtected: true };
  if (hash === '#contribute') return { view: 'contribute', isProtected: true };

  return { view: 'home' };
}

describe('Client Browser Routing & History State Synchronization', () => {
  describe('URL Path Route Resolution', () => {
    it('should resolve /trail/trail-fansipan to detail view with trailId', () => {
      const result = resolveAppRoute('/trail/trail-fansipan', '');
      expect(result.view).toBe('detail');
      expect(result.trailId).toBe('trail-fansipan');
    });

    it('should resolve /explore to explore view', () => {
      const result = resolveAppRoute('/explore', '');
      expect(result.view).toBe('explore');
      expect(result.isProtected).toBe(false);
    });

    it('should flag protected routes (admin, profile, contribute, messages)', () => {
      expect(resolveAppRoute('/admin', '').isProtected).toBe(true);
      expect(resolveAppRoute('/profile', '').isProtected).toBe(true);
      expect(resolveAppRoute('/contribute', '').isProtected).toBe(true);
      expect(resolveAppRoute('/messages', '').isProtected).toBe(true);
    });

    it('should default root path / to home view', () => {
      const result = resolveAppRoute('/', '');
      expect(result.view).toBe('home');
    });
  });

  describe('Hash Fallback & Anchor Resolution', () => {
    it('should resolve #trail-pu-si-lung to detail view with slug', () => {
      const result = resolveAppRoute('/', '#trail-pu-si-lung');
      expect(result.view).toBe('detail');
      expect(result.trailId).toBe('pu-si-lung');
    });

    it('should resolve #forum hash anchor', () => {
      const result = resolveAppRoute('/', '#forum');
      expect(result.view).toBe('forum');
    });

    it('should resolve shared expedition itinerary deep-link #itinerary/trek-abc123', () => {
      const result = resolveAppRoute('/', '#itinerary/trek-abc123');
      expect(result.view).toBe('home');
      expect(result.sharedItineraryToken).toBe('trek-abc123');
    });

    it('should resolve #trail/trail-1 hash with trailId', () => {
      const result = resolveAppRoute('/', '#trail/trail-1');
      expect(result.view).toBe('detail');
      expect(result.trailId).toBe('trail-1');
    });

    it('should resolve #messages hash with protection flag', () => {
      const result = resolveAppRoute('/', '#messages');
      expect(result.view).toBe('messages');
      expect(result.isProtected).toBe(true);
    });
  });

  describe('Query String Parser', () => {
    it('should extract view and search query parameters accurately', () => {
      const search = '?view=explore&q=Fansipan&level=hard';
      const params = new URLSearchParams(search);

      expect(params.get('view')).toBe('explore');
      expect(params.get('q')).toBe('Fansipan');
      expect(params.get('level')).toBe('hard');
    });
  });
});
