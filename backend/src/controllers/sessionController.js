import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import ActionItem from "../models/ActionItem.js";
import { resolveParticipants } from "../lib/resolveParticipants.js";

const generateJoinCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export async function createSession(req, res) {
  try {
    const { topic, teamId, participantClerkIds = [], scheduledFor } = req.body;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }

    const allMemberIds = Array.from(new Set([clerkId, ...participantClerkIds]));
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      const session = await Session.create({ 
        topic, 
        host: userId, 
        callId, 
        startTime: new Date(scheduledFor), 
        status: "scheduled",
        joinCode: generateJoinCode(),
        participants: allMemberIds
      });
      return res.status(201).json({ session });
    }

    const session = await Session.create({ 
      topic, 
      host: userId, 
      callId, 
      startTime: new Date(), 
      status: "active",
      joinCode: generateJoinCode(),
      participants: allMemberIds
    });

    await streamClient.video.call("default", callId).getOrCreate({
      data: {
        created_by_id: clerkId,
        custom: { topic, sessionId: session._id.toString() },
      },
    });

    const channel = chatClient.channel("messaging", callId, {
      name: `${topic} Session`,
      created_by_id: clerkId,
      members: allMemberIds,
    });

    await channel.create();

    res.status(201).json({ session });
  } catch (error) {
    console.log("Error in createSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getUpcomingSessions(req, res) {
  try {
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    
    const sessions = await Session.find({
      status: "scheduled",
      $or: [{ host: userId }, { participants: clerkId }],
    })
      .populate("host", "name profileImage email clerkId")
      .sort({ startTime: 1 })
      .limit(20)
      .lean();

    for (let session of sessions) {
      session.resolvedParticipants = await resolveParticipants(session.participants);
    }
    
    res.status(200).json({ sessions });
  } catch (error) {
    console.log("❌ Error in getUpcomingSessions:", error);
    res.status(500).json({ message: error.message });
  }
}

export async function getActiveSessions(_, res) {
  try {
    const sessions = await Session.find({ status: "active" })
      .populate({
        path: "host",
        select: "name profileImage email clerkId",
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    for (let session of sessions) {
      session.resolvedParticipants = await resolveParticipants(session.participants);
    }

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("❌ Error in getActiveSessions:", error);
    res.status(500).json({ message: error.message });
  }
}

export async function getMyRecentSessions(req, res) {
  try {
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    const sessions = await Session.find({
      status: "completed",
      $or: [{ host: userId }, { participants: clerkId }],
    })
      .populate({
        path: "host",
        select: "name profileImage email clerkId",
      })
      .populate("actionItems")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    for (let session of sessions) {
      session.resolvedParticipants = await resolveParticipants(session.participants);
    }

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("❌ Error in getMyRecentSessions:", error);
    res.status(500).json({ message: error.message });
  }
}

export async function getSessionById(req, res) {
  try {
    const { id } = req.params;

    let session;
    if (id.length === 6 && /^\d+$/.test(id)) {
      session = await Session.findOne({ joinCode: id })
        .populate("host", "name email profileImage clerkId")
        .lean();
    } else {
      session = await Session.findById(id)
        .populate("host", "name email profileImage clerkId")
        .lean();
    }

    if (!session) return res.status(404).json({ message: "Session not found" });

    session.resolvedParticipants = await resolveParticipants(session.participants);

    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in getSessionById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function joinSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    let session;
    if (id.length === 6 && /^\d+$/.test(id)) {
      session = await Session.findOne({ joinCode: id });
    } else {
      session = await Session.findById(id);
    }

    if (!session) return res.status(404).json({ message: "Session not found" });

    console.log(`Entering joinSession: status=${session.status}, clerkId=${clerkId}`);

    if (session.status === "completed") {
      return res.status(400).json({ message: "Cannot join a completed session" });
    }

    if (session.host.toString() === userId.toString()) {
      return res.status(400).json({ message: "Host cannot join their own session as participant" });
    }

    if (session.status === "scheduled") {
      await streamClient.video.call("default", session.callId).getOrCreate({
        data: {
          created_by_id: clerkId,
          custom: { topic: session.topic, sessionId: session._id.toString() },
        },
      });

      try {
        const channel = chatClient.channel("messaging", session.callId, {
          name: `${session.topic} Session`,
          created_by_id: clerkId,
          members: Array.from(new Set([clerkId, ...(session.participants || [])])),
        });
        await channel.create();
      } catch (channelErr) {
        console.warn(`Failed to create chat channel for scheduled session ${session.callId}:`, channelErr.message);
      }
      session.status = "active";
    }

    if (!session.participants.includes(clerkId)) {
      session.participants.push(clerkId);
    }

    if (session.status === "active") {
      const channel = chatClient.channel("messaging", session.callId);
      console.log(`Attempting to add ${clerkId} to chat channel for ${session.callId}`);
      await channel.addMembers([clerkId]);
      console.log("Chat channel member added successfully");
      
      const call = streamClient.video.call("default", session.callId);
      try {
        console.log(`Calling startTranscription for ${session.callId}`);
        const result = await call.startTranscription({ language: "en" });
        console.log("startTranscription result:", JSON.stringify(result));
      } catch (err) {
        console.error(`Failed to start transcription for ${session.callId}: ${err.message}`);
      }
    }

    await session.save();
    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in joinSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function endSession(req, res) {
  console.log("### endSession running — NO HARD DELETE VERSION ###");
  try {
    const { id } = req.params;
    const userId = req.user._id;

    let session;
    if (id && id.length === 6 && /^\d+$/.test(id)) {
      session = await Session.findOne({ joinCode: id });
    } else {
      session = await Session.findById(id);
    }

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can end the session" });
    }

    if (session.status === "completed") {
      return res.status(400).json({ message: "Session is already completed" });
    }

    if (session.status === "active") {
      const call = streamClient.video.call("default", session.callId);

      try {
        console.log(`Calling stopTranscription for ${session.callId}`);
        const result = await call.stopTranscription();
        console.log("stopTranscription result:", JSON.stringify(result));
      } catch (err) {
        console.error(`Failed to stop transcription for ${session.callId}: ${err.message}`);
      }

      const channel = chatClient.channel("messaging", session.callId);
      await channel.delete();
    }

    session.status = "completed";
    await session.save();

    res.status(200).json({ session, message: "Session ended successfully" });
  } catch (error) {
    console.log("Error in endSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
