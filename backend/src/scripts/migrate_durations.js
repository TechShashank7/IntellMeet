import { connectDB } from '../lib/db.js';
import Session from '../models/Session.js';
import mongoose from 'mongoose';

const run = async () => {
  await connectDB();

  // Find all completed meetings
  const sessions = await Session.find({ status: 'completed' });
  console.log(
    `Found ${sessions.length} completed session(s) in MongoDB. Calculating and updating durations...`
  );

  let updatedCount = 0;

  for (const session of sessions) {
    let changed = false;

    // If endTime is missing, fallback to updatedAt
    if (!session.endTime) {
      session.endTime = session.updatedAt || new Date();
      changed = true;
    }

    // Calculate duration in seconds if it's currently 0 or missing
    if (!session.duration || session.duration === 0) {
      if (session.startTime) {
        const startMs = new Date(session.startTime).getTime();
        const endMs = new Date(session.endTime).getTime();
        session.duration = Math.max(0, Math.floor((endMs - startMs) / 1000));
        changed = true;
      }
    }

    if (changed) {
      await session.save();
      updatedCount++;
      console.log(
        `✅ Updated session ${session._id} (${session.topic}) -> Duration: ${session.duration}s, EndTime: ${session.endTime}`
      );
    }
  }

  console.log(`\nDone. Updated ${updatedCount} sessions.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Fatal error running migration:', err);
  process.exit(1);
});
