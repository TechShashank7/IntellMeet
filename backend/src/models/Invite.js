import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    teamName: { type: String, required: true },
    invitedClerkId: { type: String, required: true, index: true },
    invitedByClerkId: { type: String, required: true },
    invitedByName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('Invite', inviteSchema);
