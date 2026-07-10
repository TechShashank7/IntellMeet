import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {

    topic: {
      type: String,
      required: true,
    },
    joinCode: {
      type: String,
      unique: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        type: String, // clerkIds
      },
    ],
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "active", "completed"],
      default: "active",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number, default: 0 },
    // stream video call ID
    callId: {
      type: String,
      default: "",
    },
    transcript: {
      type: String,
      default: "",
    },
    estimatedDuration: { 
      type: Number, 
      default: 30 
    },
    summary: {
      type: String, // AI-generated summary
      default: "",
    },
    actionItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ActionItem",
      },
    ],
    aiProcessingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    ratings: [
      {
        clerkId: { type: String, required: true },
        rating: { type: Number, min: 1, max: 5, default: null },
        skipped: { type: Boolean, default: false },
        ratedAt: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

meetingSchema.index({ hostId: 1, status: 1 });
export default mongoose.model("Session", meetingSchema);

