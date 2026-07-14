import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from './src/models/Session.js';

dotenv.config();

async function deleteAllUpcoming() {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");
    
    const query = { status: { $in: ["scheduled", "active"] } };

    const count = await Session.countDocuments(query);
    console.log(`Found ${count} remaining active/scheduled meetings.`);

    if (count > 0) {
      const result = await Session.deleteMany(query);
      console.log(`Deleted ${result.deletedCount} active/scheduled meetings.`);
    }

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deleteAllUpcoming();
