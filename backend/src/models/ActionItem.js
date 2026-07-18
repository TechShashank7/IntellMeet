import mongoose from 'mongoose';

/**
 * ActionItem is a single follow-up task extracted by Gemini from a
 * meeting transcript. It can optionally be "promoted" into a full
 * Task on a Kanban board (see Task model).
 */

const actionItemSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    assignee: {
      type: String, // clerkId, nullable if AI couldn't confidently assign one
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'done'],
      default: 'pending',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    sourceConfidence: {
      type: String, // AI's own confidence label, e.g. "high" | "medium" | "low"
      default: 'medium',
    },
  },
  { timestamps: true }
);

export default mongoose.model('ActionItem', actionItemSchema);
