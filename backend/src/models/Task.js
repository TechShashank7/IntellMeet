import mongoose from "mongoose";

/**
 * Task is a Kanban-board item. It can be created manually by a user,
 * or generated from a meeting's ActionItem (sourceActionItem link).
 */
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    assignee: {
      type: String, // clerkId
      default: null,
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "in_review", "done"],
      default: "todo",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    sourceActionItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      default: null,
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);