import { connectDB } from "./src/lib/db.js";
import User from "./src/models/User.js";
import Team from "./src/models/Team.js";
import mongoose from "mongoose";
import { getMeetingAnalytics } from "./src/controllers/sessionController.js";

const run = async () => {
  try {
    await connectDB();
    const user = await User.findOne();
    if (!user) {
      console.log("No user found to test with");
      return;
    }
    const team = await Team.findOne({ members: user.clerkId });
    
    console.log("Found User:", user.clerkId);
    console.log("Found Team:", team ? team._id : "none");

    const reqWithoutTeam = {
      user: { _id: user._id, clerkId: user.clerkId },
      query: {}
    };
    const resWithoutTeam = {
      status: (code) => ({
        json: (data) => console.log("\n--- WITHOUT TEAM ID ---", JSON.stringify(data, null, 2))
      })
    };
    await getMeetingAnalytics(reqWithoutTeam, resWithoutTeam);

    if (team) {
      const reqWithTeam = {
        user: { _id: user._id, clerkId: user.clerkId },
        query: { teamId: team._id.toString() }
      };
      const resWithTeam = {
        status: (code) => ({
          json: (data) => console.log("\n--- WITH TEAM ID ---", JSON.stringify(data, null, 2))
        })
      };
      await getMeetingAnalytics(reqWithTeam, resWithTeam);
    } else {
      console.log("\nNo team found for this user, skipping with teamId test.");
      
      // Let's try with ANY team just to see the result if they aren't a member
      const anyTeam = await Team.findOne();
      if (anyTeam) {
        const reqWithOtherTeam = {
          user: { _id: user._id, clerkId: user.clerkId },
          query: { teamId: anyTeam._id.toString() }
        };
        const resWithOtherTeam = {
          status: (code) => ({
            json: (data) => console.log("\n--- WITH NON-MEMBER TEAM ID ---", JSON.stringify(data, null, 2))
          })
        };
        await getMeetingAnalytics(reqWithOtherTeam, resWithOtherTeam);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.connection.close();
  }
};
run();
