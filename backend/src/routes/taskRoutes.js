import express from "express";
import { protect, attachUser } from "../middleware/auth.middleware.js";
import {
  createTask,
  getTeamTasks,
  updateTask,
  deleteTask,
} from "../controllers/task.controller.js";

const router = express.Router();

router.use(protect, attachUser);

// Nested under teams: /api/teams/:teamId/tasks
router.post("/teams/:teamId/tasks", createTask);
router.get("/teams/:teamId/tasks", getTeamTasks);

// Flat task operations: /api/tasks/:id
router.patch("/tasks/:id", updateTask); // update status, assignee, dueDate, etc.
router.delete("/tasks/:id", deleteTask);

export default router;