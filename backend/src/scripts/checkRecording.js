// backend/src/scripts/checkRecording.js
// Diagnostic script to check recordings for a specific call

import { streamClient } from '../lib/stream.js';

const callId = process.argv[2];

if (!callId) {
  console.error('Usage: node src/scripts/checkRecording.js <callId>');
  process.exit(1);
}

const run = async () => {
  const call = streamClient.video.call('default', callId);

  console.log(`Checking call: default:${callId}\n`);

  try {
    const result = await call.listRecordings();
    console.log('listRecordings() result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('listRecordings() failed:', err.message);
    process.exit(1);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
