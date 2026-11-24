import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import {
  createCheckin,
  getMyCheckins,
  getSummitLeaderboard,
  getMyActivities,
  getCommunityActivities,
} from '../controllers/checkin.controller.js';
import {
  getMySavedTrails,
  toggleSavedTrail,
  updateSavedTrailMeta,
  removeSavedTrail,
  getGearChecklist,
  upsertGearChecklist,
} from '../controllers/savedTrail.controller.js';

const router = Router();

// Check-ins & Summit Leaderboard
router.get('/checkins/leaderboard', getSummitLeaderboard);
router.get('/checkins/me', authMiddleware as any, getMyCheckins as any);
router.post('/checkins', authMiddleware as any, createCheckin as any);

// User & Community Social Activity Timelines
router.get('/activities/community', optionalAuthMiddleware as any, getCommunityActivities as any);
router.get('/activities/me', authMiddleware as any, getMyActivities as any);

// Saved Trails (Wishlist Collections, Personal Notes & Offline Status)
router.get('/saved-trails/me', authMiddleware as any, getMySavedTrails as any);
router.get('/saved-trails', authMiddleware as any, getMySavedTrails as any);
router.post('/saved-trails/:trailId', authMiddleware as any, toggleSavedTrail as any);
router.patch('/saved-trails/:trailId', authMiddleware as any, updateSavedTrailMeta as any);
router.delete('/saved-trails/:trailId', authMiddleware as any, removeSavedTrail as any);

// Cloud-Synced Gear Checklist
router.get('/gear-checklists/:trailId', authMiddleware as any, getGearChecklist as any);
router.put('/gear-checklists/:trailId', authMiddleware as any, upsertGearChecklist as any);

export default router;
