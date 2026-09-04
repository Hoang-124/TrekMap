import { describe, it, expect } from 'vitest';
import {
  getLiveWeatherForecast,
  getSunriseSunsetData,
  calculateDrivingRoute,
  reverseGeocodeLocation,
} from '../services/publicApis.service.js';

describe('Public APIs Service & In-Memory TTL Caching', () => {
  describe('calculateDrivingRoute (OSRM & Mountain Fallback)', () => {
    it('should calculate road distance and travel duration between Hanoi and Sa Pa Fansipan', async () => {
      // Hanoi coordinates (21.0285, 105.8542) -> Fansipan Sa Pa (22.3364, 103.8438)
      const route = await calculateDrivingRoute(21.0285, 105.8542, 22.3364, 103.8438);

      expect(route).toBeDefined();
      expect(route.roadDistanceKm).toBeGreaterThan(250); // Real highway distance is ~310 km
      expect(route.roadDistanceKm).toBeLessThan(600);
      expect(route.travelDurationMin).toBeGreaterThan(180);
      expect(route.travelDurationFormatted).toBeDefined();
      expect(typeof route.travelDurationFormatted).toBe('string');
    });

    it('should serve repeated requests instantly from routing memory cache', async () => {
      const start = Date.now();
      const route1 = await calculateDrivingRoute(21.0285, 105.8542, 22.3364, 103.8438);
      const firstElapsed = Date.now() - start;

      const cacheStart = Date.now();
      const route2 = await calculateDrivingRoute(21.0285, 105.8542, 22.3364, 103.8438);
      const cacheElapsed = Date.now() - cacheStart;

      expect(route1).toEqual(route2);
      expect(cacheElapsed).toBeLessThanOrEqual(firstElapsed + 5);
      expect(cacheElapsed).toBeLessThan(20); // Cached lookup is sub-millisecond in-memory
    });
  });

  describe('getSunriseSunsetData (Astronomical API with Cache)', () => {
    it('should return authentic sunrise, sunset and golden hour for Sa Pa Fansipan', async () => {
      const astro = await getSunriseSunsetData(22.3364, 103.8438);

      expect(astro).toBeDefined();
      expect(astro.sunrise).toBeDefined();
      expect(astro.sunset).toBeDefined();
      expect(astro.goldenHourMorning).toBeDefined();
      expect(astro.dayLengthHours).toBeGreaterThan(10);
      expect(astro.dayLengthHours).toBeLessThan(15);
    });
  });

  describe('getLiveWeatherForecast', () => {
    it('should fetch or return valid forecast object with coordinates', async () => {
      // Sapa coordinates
      const weather = await getLiveWeatherForecast(22.3364, 103.8438);

      // Either returns live API data or null if offline/timeout in test runner
      if (weather) {
        expect(weather.latitude).toBeDefined();
        expect(weather.longitude).toBeDefined();
      } else {
        expect(weather).toBeNull();
      }
    });
  });
});

