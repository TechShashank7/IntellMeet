import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from './src/models/Session.js'; // Adjust path if needed

dotenv.config();

async function deleteZombies() {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");

    // A zombie is a session that has a startTime older than 4 hours, and NO endTime.
    // This protects truly "future" scheduled meetings from being deleted.
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const query = {
      startTime: { $exists: true, $lt: cutoff },
      endTime: { $exists: false }
    };

    const count = await Session.countDocuments(query);
    console.log(`Found ${count} zombie meetings.`);

    if (count > 0) {
      const result = await Session.deleteMany(query);
      console.log(`Deleted ${result.deletedCount} zombie meetings.`);
    }

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deleteZombies();
