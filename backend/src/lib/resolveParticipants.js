import User from "../models/User.js";

export async function resolveParticipants(clerkIds) {
  if (!clerkIds || !clerkIds.length) return [];
  return await User.find({ clerkId: { $in: clerkIds } }).select("name email profileImage clerkId");
}
