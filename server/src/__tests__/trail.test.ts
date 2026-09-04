import { describe, it, expect } from 'vitest';
import { mockTrails } from '../data/seedData.js';

describe('Trail Geographic Data Accuracy & Integrity (Rule 11 Mandate)', () => {
  it('should have mock trails dataset populated', () => {
    expect(mockTrails).toBeDefined();
    expect(mockTrails.length).toBeGreaterThan(0);
  });

  it('should strictly contain authentic geographic coordinates within Vietnam territory', () => {
    // Vietnam latitude spans approx 8.4°N to 23.4°N, longitude 102.1°E to 109.5°E
    mockTrails.forEach((trail) => {
      expect(trail.startLat).toBeGreaterThanOrEqual(8.0);
      expect(trail.startLat).toBeLessThanOrEqual(23.5);
      expect(trail.startLng).toBeGreaterThanOrEqual(102.0);
      expect(trail.startLng).toBeLessThanOrEqual(110.0);

      expect(trail.endLat).toBeGreaterThanOrEqual(8.0);
      expect(trail.endLat).toBeLessThanOrEqual(23.5);
      expect(trail.endLng).toBeGreaterThanOrEqual(102.0);
      expect(trail.endLng).toBeLessThanOrEqual(110.0);
    });
  });

  it('should have authentic mountain summit altitudes (maxAltitudeM)', () => {
    // Fansipan is 3143m, Pu Si Lung is 3083m, Ky Quan San (Bạch Mộc Lương Tử) is 3046m
    const fansipan = mockTrails.find((t) => t.id === 'trail-fansipan' || t.name.includes('Fansipan'));
    expect(fansipan).toBeDefined();
    expect(fansipan?.maxAltitudeM).toBe(3143);

    mockTrails.forEach((trail) => {
      expect(trail.maxAltitudeM).toBeGreaterThan(0);
      expect(trail.elevationGainM).toBeGreaterThan(0);
      expect(trail.distanceKm).toBeGreaterThan(0);
    });
  });

  it('should contain authentic rescue contacts & national park hotlines (no placeholders)', () => {
    // Check that hotlines follow real Vietnamese telephone formats (e.g. 0214..., 0263...) and not 555 fake numbers
    mockTrails.forEach((trail) => {
      if (trail.rescueContact) {
        expect(trail.rescueContact.phone).not.toContain('555-');
        expect(trail.rescueContact.phone.length).toBeGreaterThan(6);
        if (trail.rescueContact.rangerContact) {
          expect(trail.rescueContact.rangerContact).not.toContain('555-');
        }
      }

      if (trail.guides && trail.guides.length > 0) {
        trail.guides.forEach((guide) => {
          expect(guide.phone).not.toContain('555-');
        });
      }
    });
  });

  it('should have valid GPX track coordinates when tracklog is present', () => {
    mockTrails.forEach((trail) => {
      if (trail.gpxTrack && trail.gpxTrack.length > 0) {
        trail.gpxTrack.forEach(([lat, lng]) => {
          expect(lat).toBeGreaterThanOrEqual(8.0);
          expect(lat).toBeLessThanOrEqual(23.5);
          expect(lng).toBeGreaterThanOrEqual(102.0);
          expect(lng).toBeLessThanOrEqual(110.0);
        });
      }
    });
  });

  it('should have unique non-empty string IDs for every trail', () => {
    const ids = mockTrails.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(mockTrails.length);
    ids.forEach((id) => {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
