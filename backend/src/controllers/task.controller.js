import asyncHandler from "express-async-handler";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import { resolveParticipants } from "../lib/resolveParticipants.js";

/**
 * Small helper: confirms the requester belongs to the given team.
 * Throws (via res.status + Error) if not — caller must be in an
 * asyncHandler context for this to be caught correctly.
 */
const assertTeamMember = async (teamId, clerkId, res) => {
  const team = await Team.findById(teamId);
  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }
  if (!team.members.includes(clerkId)) {
    res.status(403);
    throw new Error("You are not a member of this team");
  }
  return team;
};

/**
 * POST /api/teams/:teamId/tasks
 * body: { title, description?, assignee?, dueDate? }
 */
const createTask = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { title, description = "", assignee = null, dueDate = null, priority = "medium", sourceActionItem = null, sourceMeetingId = null } = req.body;

  await assertTeamMember(teamId, req.user.clerkId, res);

  if (!title) {
    res.status(400);
    throw new Error("Task title is required");
  }

  const task = await Task.create({ title, description, teamId, assignee, dueDate, priority, sourceActionItem, sourceMeetingId });
  res.status(201).json(task);
});

/**
 * GET /api/teams/:teamId/tasks
 * Supports optional ?status=todo|in_progress|done filter for board columns.
 */
const getTeamTasks = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { status } = req.query;

  await assertTeamMember(teamId, req.user.clerkId, res);

  const filter = { teamId };
  if (status) filter.status = status;

  const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();

  const assigneeClerkIds = [...new Set(tasks.map(t => t.assignee).filter(id => id != null))];
  const participants = await resolveParticipants(assigneeClerkIds);
  const participantMap = {};
  participants.forEach(p => {
    participantMap[p.clerkId] = {
      name: p.name,
      email: p.email,
      profileImage: p.profileImage,
      clerkId: p.clerkId
    };
  });

  const enrichedTasks = tasks.map(task => ({
    ...task,
    assigneeInfo: task.assignee ? (participantMap[task.assignee] || null) : null
  }));

  res.status(200).json(enrichedTasks);
});

/**
 * PATCH /api/tasks/:id
 * body: any of { title, description, assignee, status, dueDate }
 */
const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  await assertTeamMember(task.teamId, req.user.clerkId, res);

  const allowedFields = ["title", "description", "assignee", "status", "dueDate", "priority"];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      task[field] = req.body[field];
    }
  });

  await task.save();
  res.status(200).json(task);
});

/**
 * DELETE /api/tasks/:id
 */
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  await assertTeamMember(task.teamId, req.user.clerkId, res);

  await task.deleteOne();
  res.status(200).json({ message: "Task deleted" });
});

/**
 * POST /api/tasks/:id/comments
 * body: { text }
 */
const addTaskComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400);
    throw new Error("Comment text is required");
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  await assertTeamMember(task.teamId, req.user.clerkId, res);

  const comment = {
    clerkId: req.user.clerkId,
    text,
  };

  task.comments.push(comment);
  await task.save();

  res.status(201).json(task);
});

export { createTask, getTeamTasks, updateTask, deleteTask, addTaskComment };