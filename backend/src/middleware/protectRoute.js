import { requireAuth, clerkClient } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;

      if (!clerkId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let user = await User.findOne({ clerkId });

      // 🔥 FIX: create user with REAL data
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(clerkId);

        user = await User.create({
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || "test@gmail.com",
          name: clerkUser.firstName || "User",
          profileImage: clerkUser.imageUrl || "",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error in protectRoute middleware", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];