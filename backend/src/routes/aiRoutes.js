import express from "express";
import { protect, attachUser } from "../middleware/auth.middleware.js";
import {
  summarizeMeeting,
  getSessionSummary,
  promoteActionItemToTask,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.use(protect, attachUser);

// Triggers Gemini to read the transcript and produce summary + action items
router.post("/summarize/:meetingId", summarizeMeeting);

// Fetch the already-generated summary + action items for a meeting
router.get("/meetings/:meetingId/summary", getSessionSummary);

// Converts an AI-extracted ActionItem into a real Task on a team board
router.post("/action-items/:actionItemId/promote", promoteActionItemToTask);

export default router;