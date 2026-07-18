import { connectDB } from '../lib/db.js';
import { streamClient } from '../lib/stream.js';
import Session from '../models/Session.js';
import mongoose from 'mongoose';

const run = async () => {
  await connectDB();

  const sessions = await Session.find({ status: 'completed', hasRecording: false });
  console.log(
    `Found ${sessions.length} completed session(s) without hasRecording set. Checking Stream for recordings...`
  );

  let updatedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    if (!session.callId) {
      skippedCount++;
      continue;
    }

    try {
      const call = streamClient.video.call('default', session.callId);
      const result = await call.listRecordings();
      const recordings = result.recordings || [];

      if (recordings.length > 0) {
        const totalSeconds = recordings.reduce((sum, r) => {
          const start = new Date(r.start_time).getTime();
          const end = new Date(r.end_time).getTime();
          return sum + Math.max(0, Math.floor((end - start) / 1000));
        }, 0);

        session.hasRecording = true;
        session.recordingDurationSeconds = totalSeconds;
        await session.save();
        updatedCount++;
        console.log(
          `✅ ${session.topic} (${session.callId}) -> hasRecording=true, ${totalSeconds}s`
        );
      } else {
        skippedCount++;
      }
    } catch (err) {
      // Expected for very old calls Stream may have expired/cleaned up —
      // not a fatal error, just means this session has no recoverable recording.
      skippedCount++;
      console.warn(`⚠️  Skipped ${session.topic} (${session.callId}): ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updatedCount}, skipped ${skippedCount}.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Fatal error running backfill:', err);
  process.exit(1);
});
