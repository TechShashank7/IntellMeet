import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from './src/models/Session.js';

dotenv.config();

async function deleteScheduled() {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");
    
    const query = { status: "scheduled" };

    const count = await Session.countDocuments(query);
    console.log(`Found ${count} scheduled meetings.`);

    if (count > 0) {
      const result = await Session.deleteMany(query);
      console.log(`Deleted ${result.deletedCount} scheduled meetings.`);
    }

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deleteScheduled();
