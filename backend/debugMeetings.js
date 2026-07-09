import { connectDB } from "./src/lib/db.js";
import Session from "./src/models/Session.js";
import ActionItem from "./src/models/ActionItem.js";
import mongoose from "mongoose";

const run = async () => {
  try {
    await connectDB();
    const sessions = await Session.find({ status: "completed" })
      .populate("actionItems")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    sessions.forEach(s => {
      console.log(`Meeting: ${s.topic}`);
      console.log(`Action Items Count: ${s.actionItems?.length || 0}`);
      if (s.actionItems?.length > 0) {
        s.actionItems.forEach(ai => console.log(`  - ${ai.text}`));
      }
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.connection.close();
  }
};

run();
