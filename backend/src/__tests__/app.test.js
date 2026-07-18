import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { ENV } from '../lib/env.js';

describe('App API Tests', () => {
  let dbConnected = false;
  const testTeamId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    try {
      if (ENV.DB_URL) {
        await mongoose.connect(ENV.DB_URL);
        dbConnected = true;

        // Seed mock data to prevent Clerk API calls
        await mongoose.connection.collection('users').insertOne({ clerkId: 'test-user-id', name: 'Test', email: 'test@test.com' });
        await mongoose.connection.collection('users').insertOne({ clerkId: 'non-member-user-id', name: 'Non', email: 'non@test.com' });
        
        const teamObj = {
          _id: new mongoose.Types.ObjectId(testTeamId),
          name: 'Test Team',
          admin: 'test-user-id',
          members: ['test-user-id']
        };
        await mongoose.connection.collection('teams').insertOne(teamObj);
      }
    } catch (err) {
      console.warn('Could not connect to DB for tests:', err.message);
    }
  });

  afterAll(async () => {
    if (dbConnected) {
      // Clean up mock data
      await mongoose.connection.collection('users').deleteMany({ clerkId: { $in: ['test-user-id', 'non-member-user-id'] } });
      await mongoose.connection.collection('teams').deleteOne({ _id: new mongoose.Types.ObjectId(testTeamId) });
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
        .post(`/api/teams/${testTeamId}/tasks`)
        .set('x-test-bypass', 'test-user-id')
        .send({ description: 'No title' });

      expect(res.status).toBe(400);
      // console.log(res.body, res.text);
      expect(res.text).toMatch(/title is required/i);
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
        .get(`/api/teams/${testTeamId}/tasks`)
        .set('x-test-bypass', 'non-member-user-id');

      expect(res.status).toBe(403);
      expect(res.text).toMatch(/not a member|forbidden/i);
    });
  });

  describe('GET /api/teams', () => {
    it('returns teams for an authenticated test user', async () => {
      if (!dbConnected) {
        console.warn('Skipping test: No live DB connection');
        return;
      }

      const res = await request(app).get('/api/teams').set('x-test-bypass', 'test-user-id');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
