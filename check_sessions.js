import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }));
  const sessions = await Session.find().sort({ createdAt: -1 }).limit(5);
  console.log('--- Last 5 Sessions ---');
  sessions.forEach(s => {
    console.log(`Topic: ${s.topic} | teamId: ${s.teamId || 'null'} | status: ${s.status}`);
  });
  process.exit(0);
}
check();
