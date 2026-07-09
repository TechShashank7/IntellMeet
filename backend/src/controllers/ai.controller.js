import asyncHandler from "express-async-handler";
import Session from "../models/Session.js";
import ActionItem from "../models/ActionItem.js";
import Task from "../models/Task.js";
import { generateMeetingSummary } from "../services/ai.service.js";

/**
 * POST /api/ai/summarize/:meetingId
 * Reads the meeting's stored transcript, sends it to Gemini, and persists
 * the resulting summary + ActionItem documents.
 *
 * Assumes meeting.transcript has already been populated — that happens
 * either via a Stream transcription webhook or a manual upload endpoint,
 * both outside the scope of this controller.
 */
const summarizeMeeting = asyncHandler(async (req, res) => {
  const id = req.params.meetingId;
  let session;
  if (id && id.length === 6 && /^\d+$/.test(id)) {
    session = await Session.findOne({ joinCode: id });
  } else {
    session = await Session.findById(id);
  }

  if (!session) {
    res.status(404);
    throw new Error("Session not found");
  }

  if (!session.transcript || session.transcript.trim().length === 0) {
    res.status(400);
    throw new Error("This session has no transcript yet — nothing to summarize");
  }

  session.aiProcessingStatus = "processing";
  await session.save();

  try {
    const { summary, actionItems } = await generateMeetingSummary(session.transcript);

    // Wipe any previous action items for this session before re-generating,
    // so re-running summarization doesn't create duplicates.
    await ActionItem.deleteMany({ meetingId: session._id });

    const createdActionItems = await ActionItem.insertMany(
      actionItems.map((item) => ({
        meetingId: session._id,
        text: item.text,
        assignee: item.assignee || null,
        dueDate: item.dueDate || null,
        sourceConfidence: item.confidence || "medium",
      }))
    );

    session.summary = summary;
    session.actionItems = createdActionItems.map((ai) => ai._id);
    session.aiProcessingStatus = "completed";
    await session.save();

    res.status(200).json({ summary, actionItems: createdActionItems });
  } catch (err) {
    session.aiProcessingStatus = "failed";
    await session.save();
    res.status(502);
    throw new Error(`AI summarization failed: ${err.message}`);
  }
});

/**
 * GET /api/ai/sessions/:sessionId/summary
 */
const getSessionSummary = asyncHandler(async (req, res) => {
  const id = req.params.meetingId;
  let session;
  if (id && id.length === 6 && /^\d+$/.test(id)) {
    session = await Session.findOne({ joinCode: id }).populate("actionItems");
  } else {
    session = await Session.findById(id).populate("actionItems");
  }

  if (!session) {
    res.status(404);
    throw new Error("Session not found");
  }

  res.status(200).json({
    summary: session.summary,
    actionItems: session.actionItems,
    status: session.aiProcessingStatus,
  });
});

/**
 * POST /api/ai/action-items/:actionItemId/promote
 * body: { teamId }
 * Converts an AI-extracted ActionItem into a real Task on a team board.
 */
const promoteActionItemToTask = asyncHandler(async (req, res) => {
  const { teamId } = req.body;
  const actionItem = await ActionItem.findById(req.params.actionItemId);

  if (!actionItem) {
    res.status(404);
    throw new Error("Action item not found");
  }

  if (!teamId) {
    res.status(400);
    throw new Error("teamId is required to promote an action item into a task");
  }

  const task = await Task.create({
    title: actionItem.text,
    teamId,
    assignee: actionItem.assignee,
    dueDate: actionItem.dueDate,
    sourceActionItem: actionItem._id,
    sourceMeetingId: actionItem.meetingId,
  });

  res.status(201).json(task);
});

export { summarizeMeeting, getSessionSummary, promoteActionItemToTask };