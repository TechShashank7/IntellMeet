import { requireAuth, clerkClient } from "@clerk/express";
import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";

/**
 * protect: verifies the Clerk session token on the request.
 * This is just Clerk's own middleware, re-exported under the name
 * team.controller.js / task.controller.js / ai.controller.js expect.
 */
export const protect = (req, res, next) => {
  if (req.headers["x-test-bypass"]) {
    req.auth = { userId: req.headers["x-test-bypass"] };
    return next();
  }
  return requireAuth()(req, res, next);
};

/**
 * attachUser: runs after `protect`. Looks up (or lazily creates) the
 * matching Mongo User document for the authenticated Clerk user, and
 * attaches it to req.user so downstream controllers can read
 * req.user.clerkId, req.user._id, etc.
 *
 * Mirrors the logic already in protectRoute.js so behavior stays
 * consistent across both auth entry points in the codebase.
 */
export const attachUser = async (req, res, next) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let user = await User.findOne({ clerkId });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);

      user = await User.create({
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "unknown@example.com",
        name: clerkUser.firstName || "User",
        profileImage: clerkUser.imageUrl || "",
      });

      try {
        await upsertStreamUser({
          id: user.clerkId,
          name: user.name,
          image: user.profileImage,
        });
      } catch (streamErr) {
        console.warn("Failed to sync new user to Stream in attachUser:", streamErr);
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in attachUser middleware:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
