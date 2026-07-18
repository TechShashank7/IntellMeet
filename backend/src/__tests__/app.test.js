import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { ENV } from '../lib/env.js';

describe('App API Tests', () => {
  let dbConnected = false;

  beforeAll(async () => {
    try {
      if (ENV.MONGO_URI) {
        await mongoose.connect(ENV.MONGO_URI);
        dbConnected = true;
      }
    } catch (err) {
      console.warn('Could not connect to DB for tests:', err.message);
    }
  });

  afterAll(async () => {
    if (dbConnected) {
      await mongoose.disconnect();
    }
  });

  describe('POST /api/teams/:teamId/tasks', () => {
    it('returns 400 when title is missing', async () => {
      if (!dbConnected) {
        console.warn('Skipping test: No live DB connection');
        return;
      }
      
      const res = await request(app)
        .post('/api/teams/test-team-id/tasks')
        .set('x-test-bypass', 'test-user-id')
        .send({ description: 'No title' });
        
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/title is required/i);
    });
  });

  describe('GET /api/teams/:teamId/tasks', () => {
    it('returns 403 for a non-member clerkId', async () => {
      if (!dbConnected) {
        console.warn('Skipping test: No live DB connection');
        return;
      }

      // 'non-member-user-id' is assumed not to be a member of 'test-team-id'
      const res = await request(app)
        .get('/api/teams/test-team-id/tasks')
        .set('x-test-bypass', 'non-member-user-id');
        
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden/i);
    });
  });

  describe('GET /api/teams', () => {
    it('returns teams for an authenticated test user', async () => {
      if (!dbConnected) {
        console.warn('Skipping test: No live DB connection');
        return;
      }

      const res = await request(app)
        .get('/api/teams')
        .set('x-test-bypass', 'test-user-id');
        
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
