import mongoose from 'mongoose';

const meetingInviteSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    sessionTopic: { type: String, required: true },
    startTime: { type: Date, required: true },
    invitedClerkId: { type: String, required: true, index: true },
    invitedByClerkId: { type: String, required: true },
    invitedByName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('MeetingInvite', meetingInviteSchema);
