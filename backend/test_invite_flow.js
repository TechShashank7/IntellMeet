import mongoose from "mongoose";
import fetch from "node-fetch";
import { connectDB } from "./src/lib/db.js";
import User from "./src/models/User.js";
import Team from "./src/models/Team.js";
import Invite from "./src/models/Invite.js";

async function run() {
  await connectDB();
  const users = await User.find().limit(2);
  if (users.length < 2) {
    console.log("Not enough users to test. Found:", users.length);
    process.exit(1);
  }
  const admin = users[0];
  const invitee = users[1];

  console.log(`Admin: ${admin.name} (${admin.clerkId})`);
  console.log(`Invitee: ${invitee.name} (${invitee.clerkId}) - ${invitee.email}`);

  // Clean up previous test data
  await Invite.deleteMany({});
  
  // Find or create team for admin
  let team = await Team.findOne({ admin: admin.clerkId });
  if (!team) {
    team = await Team.create({ name: "Test Team", admin: admin.clerkId, members: [admin.clerkId] });
  } else {
    team.members = [admin.clerkId];
    await team.save();
  }

  const teamId = team._id.toString();
  console.log(`Team: ${team.name} (${teamId})`);

  // 1. Invite second user
  console.log("\n--- Inviting user ---");
  let res = await fetch(`http://localhost:5000/api/teams/${teamId}/members/invite`, {
    method: "POST",
    headers: { "x-test-bypass": admin.clerkId, "Content-Type": "application/json" },
    body: JSON.stringify({ email: invitee.email })
  });
  console.log("Invite Response:", res.status, await res.text());

  // Check if they are in members list
  res = await fetch(`http://localhost:5000/api/teams/${teamId}/members`, {
    headers: { "x-test-bypass": admin.clerkId }
  });
  const members = await res.json();
  const isMember = members.some(m => m.clerkId === invitee.clerkId);
  console.log("Is Invitee in members immediately?:", isMember);

  // 2. GET /api/invites as invitee
  console.log("\n--- Fetching Invites ---");
  res = await fetch(`http://localhost:5000/api/invites`, {
    headers: { "x-test-bypass": invitee.clerkId }
  });
  const invites = await res.json();
  console.log("Invites:", JSON.stringify(invites, null, 2));

  if (invites.length === 0) {
    console.log("No invites found!");
    process.exit(1);
  }
  const inviteId = invites[0]._id;

  // 3. POST /api/invites/:id/accept
  console.log(`\n--- Accepting Invite ${inviteId} ---`);
  res = await fetch(`http://localhost:5000/api/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { "x-test-bypass": invitee.clerkId }
  });
  console.log("Accept Response:", res.status, await res.text());

  // Check members again
  res = await fetch(`http://localhost:5000/api/teams/${teamId}/members`, {
    headers: { "x-test-bypass": admin.clerkId }
  });
  const membersAfter = await res.json();
  const isMemberAfter = membersAfter.some(m => m.clerkId === invitee.clerkId);
  console.log("Is Invitee in members after accept?:", isMemberAfter);

  // GET invites again
  res = await fetch(`http://localhost:5000/api/invites`, {
    headers: { "x-test-bypass": invitee.clerkId }
  });
  const invitesAfter = await res.json();
  console.log("Invites after accept count:", invitesAfter.length);

  // 4. Repeat with decline
  console.log("\n--- Testing Decline ---");
  // Remove from team first
  await Team.updateOne({ _id: teamId }, { $pull: { members: invitee.clerkId } });
  
  // Re-invite
  res = await fetch(`http://localhost:5000/api/teams/${teamId}/members/invite`, {
    method: "POST",
    headers: { "x-test-bypass": admin.clerkId, "Content-Type": "application/json" },
    body: JSON.stringify({ email: invitee.email })
  });
  
  res = await fetch(`http://localhost:5000/api/invites`, {
    headers: { "x-test-bypass": invitee.clerkId }
  });
  const newInvites = await res.json();
  if (newInvites.length === 0) {
      console.log("No new invites found!");
      process.exit(1);
  }
  const newInviteId = newInvites[0]._id;

  res = await fetch(`http://localhost:5000/api/invites/${newInviteId}/decline`, {
    method: "POST",
    headers: { "x-test-bypass": invitee.clerkId }
  });
  console.log("Decline Response:", res.status, await res.text());

  res = await fetch(`http://localhost:5000/api/teams/${teamId}/members`, {
    headers: { "x-test-bypass": admin.clerkId }
  });
  const membersAfterDecline = await res.json();
  console.log("Is Invitee in members after decline?:", membersAfterDecline.some(m => m.clerkId === invitee.clerkId));

  // 5. Test leaving team
  console.log("\n--- Testing Leave Team ---");
  // Force add back to test leave
  await Team.updateOne({ _id: teamId }, { $push: { members: invitee.clerkId } });

  res = await fetch(`http://localhost:5000/api/teams/${teamId}/leave`, {
    method: "POST",
    headers: { "x-test-bypass": invitee.clerkId }
  });
  console.log("Leave (as non-admin) Response:", res.status, await res.text());

  res = await fetch(`http://localhost:5000/api/teams/${teamId}/members`, {
    headers: { "x-test-bypass": admin.clerkId }
  });
  const membersAfterLeave = await res.json();
  console.log("Is Invitee in members after leave?:", membersAfterLeave.some(m => m.clerkId === invitee.clerkId));

  // Try to leave as admin
  res = await fetch(`http://localhost:5000/api/teams/${teamId}/leave`, {
    method: "POST",
    headers: { "x-test-bypass": admin.clerkId }
  });
  console.log("Leave (as admin) Response:", res.status, await res.text());

  process.exit(0);
}

run().catch(console.error);
