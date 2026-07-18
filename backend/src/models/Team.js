import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    admin: {
      type: String, // clerkId of the team creator/admin
      required: true,
    },
    members: [
      {
        type: String, // clerkIds
      },
    ],
    description: {
      type: String,
      default: '',
    },
    slackWebhookUrl: {
      type: String,
      default: null,
    },
    notionToken: {
      type: String,
      default: null,
    },
    notionPageId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Team', teamSchema);
