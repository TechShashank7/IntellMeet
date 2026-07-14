import mongoose from "mongoose";
import dotenv from "dotenv";
import { createSession, getMyMeetingInvites, acceptMeetingInvite, declineMeetingInvite, getUpcomingSessions } from "./src/controllers/sessionController.js";
import Session from "./src/models/Session.js";
import MeetingInvite from "./src/models/MeetingInvite.js";
import User from "./src/models/User.js";

dotenv.config();

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function runTests() {
  await mongoose.connect(process.env.DB_URL);
  console.log("Connected to DB");

  // 1. Setup mock users
  let host = await User.findOne({ name: "Host" });
  if (!host) {
    host = await User.create({ clerkId: "host_123", email: "host@example.com", name: "Host" });
  }
  let invitee = await User.findOne({ name: "Invitee" });
  if (!invitee) {
    invitee = await User.create({ clerkId: "invitee_123", email: "invitee@example.com", name: "Invitee" });
  }

  // 2. Test Scheduled Meeting Creation
  console.log("\n--- Testing Scheduled Meeting Creation ---");
  const reqCreate = {
    user: host,
    body: {
      topic: "Test Scheduled Invite Meeting",
      participantClerkIds: ["host_123", "invitee_123"],
      scheduledFor: new Date(Date.now() + 86400000).toISOString() // Tomorrow
    }
  };
  const resCreate = mockRes();
  await createSession(reqCreate, resCreate);
  
  if (resCreate.statusCode !== 201) {
    console.error("Failed to create session:", resCreate.data);
    return;
  }
  
  const createdSession = await Session.findById(resCreate.data.session._id);
  console.log("Session created. Participants:", createdSession.participants);
  if (createdSession.participants.length === 1 && createdSession.participants[0] === "host_123") {
    console.log("✅ Session participants contains only host.");
  } else {
    console.log("❌ Session participants is incorrect.");
  }

  const invites = await MeetingInvite.find({ session: createdSession._id });
  console.log(`Found ${invites.length} invite(s).`);
  if (invites.length === 1 && invites[0].invitedClerkId === "invitee_123" && invites[0].sessionTopic === "Test Scheduled Invite Meeting") {
    console.log("✅ MeetingInvite doc created correctly.");
  } else {
    console.log("❌ MeetingInvite doc is incorrect or missing.");
  }

  // 3. Test getMyMeetingInvites as invitee
  console.log("\n--- Testing getMyMeetingInvites ---");
  const reqGetInvites = { user: invitee };
  const resGetInvites = mockRes();
  await getMyMeetingInvites(reqGetInvites, resGetInvites);
  if (resGetInvites.statusCode === 200 && resGetInvites.data.length > 0) {
    console.log("✅ getMyMeetingInvites returned invites.");
  } else {
    console.log("❌ getMyMeetingInvites failed or returned no invites.");
  }

  const inviteId = invites[0]._id;

  // 4. Confirm it doesn't show up in upcoming sessions yet for invitee
  console.log("\n--- Checking upcoming sessions BEFORE accept ---");
  const reqUpcomingBefore = { user: invitee };
  const resUpcomingBefore = mockRes();
  await getUpcomingSessions(reqUpcomingBefore, resUpcomingBefore);
  const foundBefore = resUpcomingBefore.data.sessions.some(s => s._id.toString() === createdSession._id.toString());
  if (!foundBefore) {
    console.log("✅ Session NOT in upcoming (expected).");
  } else {
    console.log("❌ Session found in upcoming before accepting!");
  }

  // 5. Test Accept Invite
  console.log("\n--- Testing Accept Invite ---");
  const reqAccept = { user: invitee, params: { id: inviteId } };
  const resAccept = mockRes();
  await acceptMeetingInvite(reqAccept, resAccept);
  if (resAccept.statusCode === 200) {
    console.log("✅ Invite accepted.");
  } else {
    console.log("❌ Failed to accept invite:", resAccept.data);
  }

  const checkInvite = await MeetingInvite.findById(inviteId);
  if (!checkInvite) {
    console.log("✅ Invite document deleted.");
  } else {
    console.log("❌ Invite document STILL EXISTS.");
  }

  const checkSession = await Session.findById(createdSession._id);
  if (checkSession.participants.includes("invitee_123")) {
    console.log("✅ Session participants updated to include invitee.");
  } else {
    console.log("❌ Session participants NOT updated.");
  }

  // 6. Confirm it shows up in upcoming sessions AFTER accept for invitee
  console.log("\n--- Checking upcoming sessions AFTER accept ---");
  const reqUpcomingAfter = { user: invitee };
  const resUpcomingAfter = mockRes();
  await getUpcomingSessions(reqUpcomingAfter, resUpcomingAfter);
  const foundAfter = resUpcomingAfter.data.sessions.some(s => s._id.toString() === createdSession._id.toString());
  if (foundAfter) {
    console.log("✅ Session IS in upcoming (expected).");
  } else {
    console.log("❌ Session NOT found in upcoming after accepting!");
  }

  // 7. Test Decline Invite (create new meeting to test decline)
  console.log("\n--- Testing Decline Invite ---");
  const reqCreate2 = {
    user: host,
    body: {
      topic: "Test Decline Meeting",
      participantClerkIds: ["host_123", "invitee_123"],
      scheduledFor: new Date(Date.now() + 86400000).toISOString()
    }
  };
  const resCreate2 = mockRes();
  await createSession(reqCreate2, resCreate2);
  const createdSession2 = await Session.findById(resCreate2.data.session._id);
  const invites2 = await MeetingInvite.find({ session: createdSession2._id });
  const inviteId2 = invites2[0]._id;

  const reqDecline = { user: invitee, params: { id: inviteId2 } };
  const resDecline = mockRes();
  await declineMeetingInvite(reqDecline, resDecline);
  if (resDecline.statusCode === 200) {
    console.log("✅ Invite declined.");
  } else {
    console.log("❌ Failed to decline invite:", resDecline.data);
  }
  const checkInvite2 = await MeetingInvite.findById(inviteId2);
  if (!checkInvite2) {
    console.log("✅ Invite document deleted.");
  } else {
    console.log("❌ Invite document STILL EXISTS.");
  }
  const checkSession2 = await Session.findById(createdSession2._id);
  if (!checkSession2.participants.includes("invitee_123")) {
    console.log("✅ Session participants correctly NOT updated.");
  } else {
    console.log("❌ Session participants INCORRECTLY updated.");
  }

  // 8. Test Instant Meeting
  console.log("\n--- Testing Instant Meeting ---");
  const reqInstant = {
    user: host,
    body: {
      topic: "Test Instant Meeting",
      participantClerkIds: ["host_123", "invitee_123"]
    }
  };
  const resInstant = mockRes();
  await createSession(reqInstant, resInstant);
  if (resInstant.statusCode === 201) {
    console.log("✅ Instant session created.");
    const checkInstantSession = await Session.findById(resInstant.data.session._id);
    if (checkInstantSession.participants.includes("invitee_123") && checkInstantSession.participants.includes("host_123")) {
        console.log("✅ Instant session participants correct.");
    } else {
        console.log("❌ Instant session participants incorrect.");
    }
  } else {
    console.log("❌ Failed to create instant session:", resInstant.data);
  }


  await mongoose.disconnect();
  console.log("\nTests complete.");
}

runTests().catch(console.error);
