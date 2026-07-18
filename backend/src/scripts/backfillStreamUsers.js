// backend/src/scripts/backfillStreamUsers.js
// One-off: syncs every existing Mongo User to Stream (chat + video share the same user objects).
// Run once from the backend folder: node src/scripts/backfillStreamUsers.js

import { connectDB } from '../lib/db.js';
import User from '../models/User.js';
import { upsertStreamUser } from '../lib/stream.js';
import mongoose from 'mongoose';

const run = async () => {
  await connectDB();

  const users = await User.find({});
  console.log(`Found ${users.length} user(s) in MongoDB. Syncing to Stream...`);

  let succeeded = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await upsertStreamUser({
        id: u.clerkId,
        name: u.name,
        image: u.profileImage,
      });
      succeeded++;
      console.log(`✅ Synced ${u.name} (${u.clerkId})`);
    } catch (err) {
      failed++;
      console.error(`❌ Failed to sync ${u.name} (${u.clerkId}):`, err.message);
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Fatal error running backfill:', err);
  process.exit(1);
});
