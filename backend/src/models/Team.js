import mongoose from "mongoose";


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
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);