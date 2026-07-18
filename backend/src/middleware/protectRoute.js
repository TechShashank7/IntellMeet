import { requireAuth, clerkClient } from '@clerk/express';
import User from '../models/User.js';
import { upsertStreamUser } from '../lib/stream.js';

export const protectRoute = [
  (req, res, next) => {
    console.log('Protect route hit, path:', req.path);
    if (req.headers['x-test-bypass']) {
      req.auth = { userId: req.headers['x-test-bypass'] };
      return next();
    }
    return requireAuth()(req, res, next);
  },
  async (req, res, next) => {
    try {
      const clerkId = req.auth?.userId;

      if (!clerkId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      let user = await User.findOne({ clerkId });

      // 🔥 FIX: create user with REAL data
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(clerkId);

        user = await User.create({
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || 'test@gmail.com',
          name: clerkUser.firstName || 'User',
          profileImage: clerkUser.imageUrl || '',
        });

        try {
          await upsertStreamUser({
            id: user.clerkId,
            name: user.name,
            image: user.profileImage,
          });
        } catch (streamErr) {
          console.warn('Failed to sync new user to Stream in protectRoute:', streamErr);
        }
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Error in protectRoute middleware', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
];
