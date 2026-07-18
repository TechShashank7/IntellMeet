// backend/src/scripts/checkTranscription.js
// Diagnostic: asks Stream directly whether a transcript file was ever produced
// for a given call, bypassing the webhook entirely.
// Run from the backend folder:
//   node src/scripts/checkTranscription.js session_1783499427334_akgs6c

import { streamClient } from '../lib/stream.js';

const callId = process.argv[2];

if (!callId) {
  console.error('Usage: node src/scripts/checkTranscription.js <callId>');
  process.exit(1);
}

const run = async () => {
  const call = streamClient.video.call('default', callId);

  console.log(`Checking call: default:${callId}\n`);

  // 1. Basic call state — confirms Stream still knows about this call at all
  try {
    const state = await call.get();
    console.log('Call state:', JSON.stringify(state.call, null, 2).slice(0, 500), '...\n');
  } catch (err) {
    console.log('call.get() failed (call may have been hard-deleted):', err.message, '\n');
  }

  // 2. List transcriptions — the real answer we want
  try {
    const transcriptions = await call.listTranscriptions();
    console.log('listTranscriptions() result:');
    console.log(JSON.stringify(transcriptions, null, 2));
  } catch (err) {
    console.log('listTranscriptions() failed:', err.message);
    console.log(
      '\nFalling back: inspecting available methods on the call object for anything transcription-related...'
    );
    let proto = Object.getPrototypeOf(call);
    const found = new Set();
    while (proto) {
      Object.getOwnPropertyNames(proto)
        .filter((name) => /transcri/i.test(name))
        .forEach((name) => found.add(name));
      proto = Object.getPrototypeOf(proto);
    }
    console.log('Matching methods found:', [...found]);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
