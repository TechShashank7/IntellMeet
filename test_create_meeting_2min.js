const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/meetings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-test-bypass': 'true' // Bypasses Clerk auth for local testing
  }
};

const startTime = new Date(Date.now() + 2 * 60000).toISOString();

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Body:', data);
    const parsed = JSON.parse(data);
    if (parsed.session) {
      console.log(`\nTEST URL:\nhttp://localhost:5173/meeting/${parsed.session.joinCode || parsed.session._id}`);
    }
  });
});

req.on('error', e => console.error(e));

req.write(JSON.stringify({ 
  topic: 'Test Gate 2 mins out', 
  scheduledFor: startTime, 
  participantClerkIds: ['test-guest-id'] 
}));
req.end();
