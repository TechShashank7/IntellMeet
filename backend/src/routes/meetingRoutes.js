import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  createSession,
  endSession,
  getActiveSessions,
  getMyRecentSessions,
  getSessionById,
  joinSession,
  getUpcomingSessions,
  rateSession,
  getMeetingStats,
  getMeetingAnalytics,
} from "../controllers/sessionController.js";

const router = express.Router();

router.post("/", protectRoute, createSession);
router.get("/active", protectRoute, getActiveSessions);
router.get("/my-recent", protectRoute, getMyRecentSessions);
router.get("/upcoming", protectRoute, getUpcomingSessions);
router.get("/stats", protectRoute, getMeetingStats);
router.get("/analytics", protectRoute, getMeetingAnalytics);

router.get("/:id", protectRoute, getSessionById);
router.post("/:id/join", protectRoute, joinSession);
router.post("/:id/end", protectRoute, endSession);
router.post("/:id/rate", protectRoute, rateSession);

export default router;
