import PDFDocument from "pdfkit";
import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import ActionItem from "../models/ActionItem.js";
import MeetingInvite from "../models/MeetingInvite.js";
import Team from "../models/Team.js";
import Task from "../models/Task.js";
import { resolveParticipants } from "../lib/resolveParticipants.js";
import { postMeetingToSlack, syncMeetingToNotion as doSyncMeetingToNotion } from "../services/integrations.service.js";

const generateJoinCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const isSessionMember = (session, req) => {
  const isHost = session.host.toString() === req.user._id.toString();
  const isParticipant = session.participants.includes(req.user.clerkId);
  return isHost || isParticipant;
};

export async function createSession(req, res) {
  try {
    const { topic, participantClerkIds = [], scheduledFor, openForAll = false, teamId } = req.body;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const hostName = req.user.name;

    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }

    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const isScheduled = !!scheduledFor;
    const startTime = isScheduled ? new Date(scheduledFor) : new Date();

    if (isScheduled) {
      // Scheduled path: host only at creation. Invited teammates get a
      // MeetingInvite instead of instant participant access — Stream call/
      // channel creation is deferred to joinSession's existing scheduled→active
      // transition, exactly as before this feature was added.
      const session = await Session.create({
        topic,
        host: userId,
        callId,
        startTime,
        status: "scheduled",
        joinCode: generateJoinCode(),
        participants: [clerkId],
        openForAll,
        teamId: teamId || null,
      });

      const inviteeIds = Array.from(new Set(participantClerkIds.filter((cid) => cid !== clerkId)));
      if (inviteeIds.length > 0) {
        await MeetingInvite.insertMany(
          inviteeIds.map((invitedClerkId) => ({
            session: session._id,
            sessionTopic: topic,
            startTime,
            invitedClerkId,
            invitedByClerkId: clerkId,
            invitedByName: hostName,
          }))
        );
      }

      return res.status(201).json({ session });
    }

    // Instant path: completely unchanged from the original implementation.
    // No MeetingInvite involved — anyone passed here gets direct access,
    // same as every instant meeting created before this feature existed.
    const allMemberIds = Array.from(new Set([clerkId, ...participantClerkIds]));

    const session = await Session.create({
      topic,
      host: userId,
      callId,
      startTime,
      status: "active",
      joinCode: generateJoinCode(),
      participants: allMemberIds,
      openForAll,
      teamId: teamId || null,
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
    
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago

    const sessions = await Session.find({
      status: { $in: ["scheduled", "active"] },
      startTime: { $gte: cutoff },
      $or: [{ host: userId }, { participants: clerkId }],
    })
      .populate("host", "name profileImage email clerkId")
      .sort({ startTime: 1 })
      .limit(20)
      .lean();

    for (let session of sessions) {
      session.resolvedParticipants = await resolveParticipants(session.participants);
      
      // If user is host, fetch pending invites to show in the manage UI
      if (session.host.clerkId === clerkId || session.host._id.toString() === userId.toString()) {
        const pendingInvites = await MeetingInvite.find({ session: session._id, status: "pending" });
        if (pendingInvites.length > 0) {
          const pendingClerkIds = pendingInvites.map(i => i.invitedClerkId);
          session.pendingInvitees = await resolveParticipants(pendingClerkIds);
        } else {
          session.pendingInvitees = [];
        }
      }
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

    const isHost = session.host.toString() === userId.toString();

    if (session.status === "completed") {
      return res.status(400).json({ message: "Cannot join a completed session" });
    }

    if (!isHost && session.status === "scheduled" && Date.now() < new Date(session.startTime).getTime()) {
      return res.status(403).json({ message: "This meeting hasn't started yet", startTime: session.startTime });
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

    if (!isHost && !session.participants.includes(clerkId)) {
      session.participants.push(clerkId);
    }

    if (session.status === "active") {
      if (!isHost) {
        const channel = chatClient.channel("messaging", session.callId);
        console.log(`Attempting to add ${clerkId} to chat channel for ${session.callId}`);
        await channel.addMembers([clerkId]);
        console.log("Chat channel member added successfully");
      }
      
      const call = streamClient.video.call("default", session.callId);
      try {
        console.log(`Calling startTranscription for ${session.callId}`);
        const result = await call.startTranscription({ language: "en" });
        console.log("startTranscription result:", JSON.stringify(result));
        session.transcriptionStartedAt = new Date();
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

export async function requestToJoin(req, res) {
  try {
    const { id } = req.params;
    const clerkId = req.user.clerkId;
    const userId = req.user._id;

    let session = id.length === 6 && /^\d+$/.test(id)
      ? await Session.findOne({ joinCode: id })
      : await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    const isHost = session.host.toString() === userId.toString();
    if (isHost || session.participants.includes(clerkId)) {
      return res.status(200).json({ status: "admitted" });
    }

    if (session.openForAll) {
      if (!session.participants.includes(clerkId)) {
        session.participants.push(clerkId);
        await session.save();
      }
      return res.status(200).json({ status: "admitted" });
    }

    // Clear any prior denial so a re-request starts fresh
    session.deniedClerkIds = session.deniedClerkIds.filter((cid) => cid !== clerkId);

    const alreadyWaiting = session.waitingRoom.some((w) => w.clerkId === clerkId);
    if (!alreadyWaiting) {
      session.waitingRoom.push({
        clerkId,
        name: req.user.name,
        profileImage: req.user.profileImage,
        requestedAt: new Date(),
      });
    }

    await session.save();
    res.status(200).json({ status: "waiting" });
  } catch (error) {
    console.log("Error in requestToJoin controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getWaitingRoomStatus(req, res) {
  try {
    const { id } = req.params;
    const clerkId = req.user.clerkId;
    const userId = req.user._id;

    let session = id.length === 6 && /^\d+$/.test(id)
      ? await Session.findOne({ joinCode: id })
      : await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    const isHost = session.host.toString() === userId.toString();
    if (isHost || session.participants.includes(clerkId)) {
      return res.status(200).json({ status: "admitted" });
    }
    if (session.deniedClerkIds.includes(clerkId)) {
      return res.status(200).json({ status: "denied" });
    }
    res.status(200).json({ status: "waiting" });
  } catch (error) {
    console.log("Error in getWaitingRoomStatus controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getWaitingRoom(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can view the waiting room" });
    }

    const sorted = [...session.waitingRoom].sort((a, b) => a.requestedAt - b.requestedAt);
    res.status(200).json({ waitingRoom: sorted });
  } catch (error) {
    console.log("Error in getWaitingRoom controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function admitFromWaitingRoom(req, res) {
  try {
    const { id, clerkId } = req.params;
    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can admit participants" });
    }

    session.waitingRoom = session.waitingRoom.filter((w) => w.clerkId !== clerkId);
    if (!session.participants.includes(clerkId)) {
      session.participants.push(clerkId);
    }
    session.deniedClerkIds = session.deniedClerkIds.filter((cid) => cid !== clerkId);

    await session.save();
    res.status(200).json({ message: "Admitted" });
  } catch (error) {
    console.log("Error in admitFromWaitingRoom controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function denyFromWaitingRoom(req, res) {
  try {
    const { id, clerkId } = req.params;
    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can deny participants" });
    }

    session.waitingRoom = session.waitingRoom.filter((w) => w.clerkId !== clerkId);
    if (!session.deniedClerkIds.includes(clerkId)) {
      session.deniedClerkIds.push(clerkId);
    }

    await session.save();
    res.status(200).json({ message: "Denied" });
  } catch (error) {
    console.log("Error in denyFromWaitingRoom controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function admitAllFromWaitingRoom(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can admit participants" });
    }

    const clerkIdsToAdmit = session.waitingRoom.map((w) => w.clerkId);
    clerkIdsToAdmit.forEach((cid) => {
      if (!session.participants.includes(cid)) {
        session.participants.push(cid);
      }
    });
    session.waitingRoom = [];
    session.deniedClerkIds = session.deniedClerkIds.filter((cid) => !clerkIdsToAdmit.includes(cid));

    await session.save();
    res.status(200).json({ message: "Admitted all" });
  } catch (error) {
    console.log("Error in admitAllFromWaitingRoom controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateOpenForAll(req, res) {
  try {
    const { id } = req.params;
    const { openForAll } = req.body;
    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can change this setting" });
    }

    session.openForAll = !!openForAll;

    // Turning this on means there's no more waiting room concept — auto-admit
    // anyone currently waiting so they aren't stuck.
    if (session.openForAll && session.waitingRoom.length > 0) {
      const clerkIdsToAdmit = session.waitingRoom.map((w) => w.clerkId);
      clerkIdsToAdmit.forEach((cid) => {
        if (!session.participants.includes(cid)) {
          session.participants.push(cid);
        }
      });
      session.waitingRoom = [];
    }

    await session.save();
    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in updateOpenForAll controller:", error.message);
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

      try {
        const recordingResult = await call.listRecordings();
        const recordings = recordingResult.recordings || [];
        if (recordings.length > 0) {
          const totalSeconds = recordings.reduce((sum, r) => {
            const start = new Date(r.start_time).getTime();
            const end = new Date(r.end_time).getTime();
            return sum + Math.max(0, Math.floor((end - start) / 1000));
          }, 0);
          session.hasRecording = true;
          session.recordingDurationSeconds = totalSeconds;
        }
      } catch (err) {
        console.warn(`Failed to check for recordings at end of session for ${session.callId}: ${err.message}`);
      }

      // We intentionally do NOT delete the channel here. Deleting the channel while
      // participants are still connected causes the Stream Chat SDK to throw 404 errors
      // when it attempts to poll or fetch members. The channel will remain intact.
      // const channel = chatClient.channel("messaging", session.callId);
      // await channel.delete();
    }

    session.status = "completed";
    session.endTime = new Date();
    if (session.startTime) {
      session.duration = Math.max(0, Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000));
    }
    await session.save();

    res.status(200).json({ session, message: "Session ended successfully" });
  } catch (error) {
    console.log("Error in endSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function rateSession(req, res) {
  try {
    const { id } = req.params;
    const clerkId = req.user.clerkId;
    const { rating, skipped } = req.body;

    let session;
    if (id && id.length === 6 && /^\d+$/.test(id)) {
      session = await Session.findOne({ joinCode: id });
    } else {
      session = await Session.findById(id);
    }

    if (!session) return res.status(404).json({ message: "Session not found" });

    const isValidRating = Number.isInteger(rating) && rating >= 1 && rating <= 5;
    const isSkipped = skipped === true;

    if ((!isValidRating && !isSkipped) || (isValidRating && isSkipped)) {
      return res.status(400).json({ message: "Provide either a valid rating (1-5) or skipped=true" });
    }

    if (!session.ratings) {
      session.ratings = [];
    }

    const existingIndex = session.ratings.findIndex(r => r.clerkId === clerkId);

    if (existingIndex !== -1) {
      session.ratings[existingIndex].rating = isValidRating ? rating : null;
      session.ratings[existingIndex].skipped = isSkipped;
      session.ratings[existingIndex].ratedAt = new Date();
    } else {
      session.ratings.push({
        clerkId,
        rating: isValidRating ? rating : null,
        skipped: isSkipped,
        ratedAt: new Date()
      });
    }

    await session.save();
    res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error in rateSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMeetingStats(req, res) {
  try {
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    const startOfThisWeek = new Date();
    startOfThisWeek.setHours(0, 0, 0, 0);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());

    const startOfNextWeek = new Date(startOfThisWeek);
    startOfNextWeek.setDate(startOfThisWeek.getDate() + 7);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const filter = { $or: [{ host: userId }, { participants: clerkId }] };

    const thisWeekCount = await Session.countDocuments({ 
      ...filter, 
      startTime: { $gte: startOfThisWeek, $lt: startOfNextWeek } 
    });

    const lastWeekCount = await Session.countDocuments({ 
      ...filter, 
      startTime: { $gte: startOfLastWeek, $lt: startOfThisWeek } 
    });

    res.status(200).json({ thisWeekCount, lastWeekCount });
  } catch (error) {
    console.log("Error in getMeetingStats controller:", error.message);
    res.status(500).json({ message: error.message });
  }
}

export async function getMeetingAnalytics(req, res) {
  try {
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const teamId = req.query.teamId;
    const filter = { $or: [{ host: userId }, { participants: clerkId }], status: "completed" };

    const sessions = await Session.find(filter).select("duration startTime ratings participants").lean();

    const totalMeetings = sessions.length;
    const totalDurationSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgDurationMinutes = totalMeetings > 0 ? Math.round((totalDurationSeconds / totalMeetings) / 60) : 0;
    const totalHours = Math.round((totalDurationSeconds / 3600) * 10) / 10;

    const myRatings = sessions
      .flatMap(s => s.ratings || [])
      .filter(r => r.clerkId === clerkId && r.rating != null);
    const avgRating = myRatings.length > 0
      ? Math.round((myRatings.reduce((sum, r) => sum + r.rating, 0) / myRatings.length) * 10) / 10
      : null;

    const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
      stars: star,
      count: myRatings.filter(r => r.rating === star).length
    }));

    const now = new Date();
    const weeklyTrend = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const count = sessions.filter(s => {
        const st = new Date(s.startTime);
        return st >= weekStart && st < weekEnd;
      }).length;
      weeklyTrend.push({ week: weekStart.toISOString().split('T')[0], count });
    }

    const avgAttendeesPerMeeting = totalMeetings > 0
      ? Math.round((sessions.reduce((sum, s) => sum + (s.participants ? s.participants.length : 0), 0) / totalMeetings) * 10) / 10
      : 0;

    const ratingResponseRate = totalMeetings > 0
      ? Math.round((sessions.filter(s => (s.ratings || []).some(r => r.clerkId === clerkId && r.rating != null)).length / totalMeetings) * 100)
      : 0;

    const participantCounts = {};
    sessions.forEach(s => {
      (s.participants || []).forEach(p => {
        if (p !== clerkId) {
          participantCounts[p] = (participantCounts[p] || 0) + 1;
        }
      });
    });

    const topParticipantIds = Object.entries(participantCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    const resolvedTopParticipants = await resolveParticipants(topParticipantIds);
    const topParticipants = topParticipantIds.map(id => {
      const p = resolvedTopParticipants.find(rp => rp.clerkId === id);
      return {
        clerkId: id,
        name: p ? p.name : "Unknown",
        profileImage: p ? p.profileImage : "",
        meetingCount: participantCounts[id]
      };
    });

    const engagement = {
      avgAttendeesPerMeeting,
      ratingResponseRate,
      topParticipants
    };

    let productivity = null;
    if (teamId) {
      const team = await Team.findById(teamId);
      if (team && team.members.includes(clerkId)) {
        const totalTasks = await Task.countDocuments({ teamId });
        const completedTasks = await Task.countDocuments({ teamId, status: "done" });
        const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        const overdueTasks = await Task.countDocuments({ teamId, status: { $ne: "done" }, dueDate: { $lt: now } });
        
        const sessionIds = sessions.map(s => s._id);
        const actionItems = await ActionItem.find({ meetingId: { $in: sessionIds } });
        
        const avgActionItemsPerMeeting = totalMeetings > 0
          ? Math.round((actionItems.length / totalMeetings) * 10) / 10
          : 0;
          
        let convertedCount = 0;
        if (actionItems.length > 0) {
          const actionItemIds = actionItems.map(a => a._id);
          const distinctConverted = await Task.distinct("sourceActionItem", { sourceActionItem: { $in: actionItemIds } });
          convertedCount = distinctConverted.length;
        }
        
        const actionItemToTaskConversionRate = actionItems.length > 0
          ? Math.round((convertedCount / actionItems.length) * 100)
          : 0;
          
        productivity = {
          totalTasks,
          completedTasks,
          taskCompletionRate,
          overdueTasks,
          avgActionItemsPerMeeting,
          actionItemToTaskConversionRate
        };
      }
    }

    res.status(200).json({
      totalMeetings, avgDurationMinutes, totalHours, avgRating,
      ratingCount: myRatings.length, ratingDistribution, weeklyTrend,
      engagement,
      productivity
    });
  } catch (error) {
    console.log("Error in getMeetingAnalytics controller:", error.message);
    res.status(500).json({ message: error.message });
  }
}

export async function getMyMeetingInvites(req, res) {
  try {
    const invites = await MeetingInvite.find({ invitedClerkId: req.user.clerkId, status: "pending" }).sort({ createdAt: -1 });
    res.status(200).json(invites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function acceptMeetingInvite(req, res) {
  try {
    const invite = await MeetingInvite.findById(req.params.id);
    if (!invite || invite.invitedClerkId !== req.user.clerkId) {
      return res.status(404).json({ message: "Invite not found" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: "This invite has already been responded to" });
    }
    const session = await Session.findById(invite.session);
    if (session && !session.participants.includes(req.user.clerkId)) {
      session.participants.push(req.user.clerkId);
      await session.save();
    }
    await invite.deleteOne();
    res.status(200).json({ message: "Invite accepted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function declineMeetingInvite(req, res) {
  try {
    const invite = await MeetingInvite.findById(req.params.id);
    if (!invite || invite.invitedClerkId !== req.user.clerkId) {
      return res.status(404).json({ message: "Invite not found" });
    }
    await invite.deleteOne();
    res.status(200).json({ message: "Invite declined" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteMeeting(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    
    // Only the host can delete the meeting
    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this meeting" });
    }

    // Delete all associated invites
    await MeetingInvite.deleteMany({ session: session._id });
    
    // Delete the session
    await session.deleteOne();
    
    res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function leaveMeeting(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    
    // Remove participant from the array
    const originalLength = session.participants.length;
    session.participants = session.participants.filter(p => p !== req.user.clerkId);
    
    if (session.participants.length === originalLength) {
      return res.status(400).json({ message: "You are not a participant in this meeting" });
    }
    
    await session.save();
    res.status(200).json({ message: "Left meeting successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function addMeetingParticipants(req, res) {
  try {
    const { participantClerkIds = [] } = req.body;
    if (!participantClerkIds.length) {
      return res.status(400).json({ message: "No participants provided" });
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to invite participants to this meeting" });
    }

    const existingInvites = await MeetingInvite.find({ session: session._id });
    const existingInvitedIds = existingInvites.map(i => i.invitedClerkId);

    const inviteeIds = Array.from(new Set(participantClerkIds.filter((cid) => 
      cid !== req.user.clerkId && 
      !session.participants.includes(cid) && 
      !existingInvitedIds.includes(cid)
    )));

    if (inviteeIds.length > 0) {
      await MeetingInvite.insertMany(
        inviteeIds.map((invitedClerkId) => ({
          session: session._id,
          sessionTopic: session.topic,
          startTime: session.startTime,
          invitedClerkId,
          invitedByClerkId: req.user.clerkId,
          invitedByName: req.user.name,
        }))
      );
    }

    res.status(200).json({ message: "Participants invited successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function removeMeetingParticipant(req, res) {
  try {
    const { participantClerkId } = req.body;
    if (!participantClerkId) {
      return res.status(400).json({ message: "Participant clerkId is required" });
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (session.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to remove participants from this meeting" });
    }

    // 1. Remove from session.participants if they have already joined/accepted
    session.participants = session.participants.filter(p => p !== participantClerkId);
    await session.save();

    // 2. Delete any pending MeetingInvite for this user
    await MeetingInvite.deleteMany({ session: session._id, invitedClerkId: participantClerkId });

    res.status(200).json({ message: "Participant removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getMyRecordingsList(req, res) {
  try {
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    const sessions = await Session.find({
      status: "completed",
      hasRecording: true,
      $or: [{ host: userId }, { participants: clerkId }],
    })
      .select("topic startTime endTime callId participants recordingDurationSeconds")
      .sort({ startTime: -1 })
      .limit(50)
      .lean();

    for (let session of sessions) {
      session.resolvedParticipants = await resolveParticipants(session.participants);
    }

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getMyRecordingsList controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getRecordingDetail(req, res) {
  try {
    const { id } = req.params;
    const session = await Session.findById(id).lean();

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Re-fetch as a full Mongoose doc only for the access check helper,
    // since isSessionMember expects the shape used elsewhere in this file
    const fullSession = await Session.findById(id);
    if (!isSessionMember(fullSession, req)) {
      return res.status(403).json({ message: "You do not have access to this meeting's recording" });
    }

    const resolvedParticipants = await resolveParticipants(session.participants);
    const participantsPayload = resolvedParticipants.map((p) => ({
      clerkId: p.clerkId,
      name: p.name,
      profileImage: p.profileImage,
    }));

    let hostInfo = null;
    if (fullSession.host) {
      const hostUser = await User.findById(fullSession.host).select("name clerkId profileImage");
      if (hostUser) {
        hostInfo = { clerkId: hostUser.clerkId, name: hostUser.name, profileImage: hostUser.profileImage };
      }
    }

    let recordings = [];
    try {
      const call = streamClient.video.call("default", session.callId);
      const result = await call.listRecordings();
      recordings = (result.recordings || []).map((r) => ({
        url: r.url,
        filename: r.filename,
        startTime: r.start_time,
        endTime: r.end_time,
      }));
    } catch (err) {
      console.warn(`Failed to fetch recordings for ${session.callId}:`, err.message);
      // Not fatal — meeting may have no recording, or Stream call may be
      // long expired. Detail view should still render transcript/notes.
    }

    res.status(200).json({
      session: {
        id: session._id,
        topic: session.topic,
        startTime: session.startTime,
        endTime: session.endTime,
        recordingDurationSeconds: session.recordingDurationSeconds || 0,
        transcriptSegments: session.transcriptSegments || [],
        summary: session.summary || "",
      },
      recordings,
      participants: participantsPayload,
      host: hostInfo,
    });
  } catch (error) {
    console.log("Error in getRecordingDetail controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function exportMeetingNotes(req, res) {
  try {
    const { id } = req.params;
    const { type } = req.query;
    let query = { callId: id };
    if (id && id.length === 24) {
      query = { $or: [{ _id: id }, { callId: id }] };
    }
    const session = await Session.findOne(query)
      .populate("host", "name clerkId")
      .populate("actionItems");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!isSessionMember(session, req)) {
      return res.status(403).json({ message: "You do not have access to this meeting's notes" });
    }

    // Build clerkId -> name map for resolving transcript speakers and
    // action item assignees
    const resolvedParticipants = await resolveParticipants(session.participants);
    const nameMap = {};
    resolvedParticipants.forEach((p) => { nameMap[p.clerkId] = p.name; });
    if (session.host?.clerkId) {
      nameMap[session.host.clerkId] = session.host.name;
    }

    const formatTime = (date) => {
      if (!date) return "";
      return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    const safeFilename = (session.topic || "meeting").replace(/[^a-z0-9]/gi, "_").toLowerCase();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}-${type === 'summary' ? 'summary' : 'notes'}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // --- Header ---
    doc.fontSize(20).text(session.topic || "Meeting Notes", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#6B7280").text(
      `${new Date(session.startTime).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`
    );
    doc.moveDown(1.2);
    doc.fillColor("#000000");

    if (type === 'summary') {
      // --- Executive Summary ---
      doc.fontSize(14).text("Executive Summary", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      if (session.summary && session.summary.trim().length > 0) {
        session.summary.split("\n").filter((l) => l.trim().length > 0).forEach((line) => {
          doc.text(`•  ${line.replace(/^-?\s*/, "").trim()}`, { indent: 10 });
        });
      } else {
        doc.fillColor("#6B7280").text("No summary available for this meeting.");
        doc.fillColor("#000000");
      }
      doc.moveDown(1.5);

      // --- Action Items ---
      doc.fontSize(14).text("Action Items", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      if (session.actionItems && session.actionItems.length > 0) {
        session.actionItems.forEach((ai) => {
          const assigneeName = ai.assignee ? (nameMap[ai.assignee] || "Unknown user") : "Unassigned";
          const dateText = ai.dueDate ? new Date(ai.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date";
          doc.text(`•  ${ai.text} `, { indent: 10, continued: true });
          doc.fillColor("#6B7280").text(`[${assigneeName} - ${dateText}]`);
          doc.fillColor("#000000");
        });
      } else {
        doc.fillColor("#6B7280").text("No action items for this meeting.");
        doc.fillColor("#000000");
      }
      doc.moveDown(1.5);

      doc.moveDown(1.5);
    } else {
      // --- Notes: Summary ---
      doc.fontSize(14).text("Summary", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      if (session.summary && session.summary.trim().length > 0) {
        session.summary.split("\n").filter((l) => l.trim().length > 0).forEach((line) => {
          doc.text(`•  ${line.replace(/^-?\s*/, "").trim()}`, { indent: 10 });
        });
      } else {
        doc.fillColor("#6B7280").text("No summary available for this meeting.");
        doc.fillColor("#000000");
      }
      doc.moveDown(1);

      doc.moveDown(1);

      // --- Transcript ---
      doc.addPage();
      doc.fontSize(14).text("Transcript", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      if (session.transcriptSegments && session.transcriptSegments.length > 0) {
        session.transcriptSegments.forEach((seg) => {
          const speakerName = seg.speakerId ? (nameMap[seg.speakerId] || "Unknown speaker") : "Unknown speaker";
          const time = formatTime(seg.timestamp);
          doc.fillColor("#4F46E5").text(`${speakerName}${time ? "  ·  " + time : ""}`, { continued: false });
          doc.fillColor("#111827").text(seg.text);
          doc.moveDown(0.5);
        });
      } else if (session.transcript && session.transcript.trim().length > 0) {
        doc.fillColor("#6B7280").text(
          "(Detailed speaker/timestamp breakdown not available for this meeting — showing raw transcript.)"
        );
        doc.moveDown(0.5);
        doc.fillColor("#111827").text(session.transcript);
      } else {
        doc.fillColor("#6B7280").text("No transcript available for this meeting.");
      }
    }

    // Wait for the stream to finish before ending the Vercel function
    await new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
      doc.end();
    });
  } catch (error) {
    console.error("Error in exportMeetingNotes controller:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
}

export async function shareMeetingToSlack(req, res) {
  try {
    const { id } = req.params;
    let query = { callId: id };
    if (id && id.length === 24) {
      query = { $or: [{ _id: id }, { callId: id }] };
    }
    const session = await Session.findOne(query).populate("actionItems").lean();
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (!isSessionMember(session, req)) {
      return res.status(403).json({ message: "You do not have access to share this meeting" });
    }

    if (!session.teamId) {
      return res.status(400).json({ message: "This meeting is not associated with a team" });
    }

    const team = await Team.findById(session.teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (!team.slackWebhookUrl) {
      return res.status(400).json({ message: "Please do slack integration on Teams section first" });
    }

    const resolvedParticipants = await resolveParticipants(session.participants);
    const nameMap = {};
    resolvedParticipants.forEach((p) => { nameMap[p.clerkId] = p.name; });

    if (session.actionItems && session.actionItems.length > 0) {
      session.actionItems = session.actionItems.map(ai => ({
        ...ai,
        assigneeName: ai.assignee ? (nameMap[ai.assignee] || "Unknown user") : "Unassigned"
      }));
    }

    const result = await postMeetingToSlack(session, team);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in shareMeetingToSlack:", error.message);
    res.status(400).json({ message: error.message });
  }
}

export async function syncMeetingToNotion(req, res) {
  try {
    const { id } = req.params;
    let query = { callId: id };
    if (id && id.length === 24) {
      query = { $or: [{ _id: id }, { callId: id }] };
    }
    const session = await Session.findOne(query).populate("actionItems").lean();
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (!isSessionMember(session, req)) {
      return res.status(403).json({ message: "You do not have access to share this meeting" });
    }

    if (!session.teamId) {
      return res.status(400).json({ message: "This meeting is not associated with a team" });
    }

    const team = await Team.findById(session.teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (!team.notionToken || !team.notionPageId) {
      return res.status(400).json({ message: "Please do notion integration on Teams section first" });
    }

    const resolvedParticipants = await resolveParticipants(session.participants);
    const nameMap = {};
    resolvedParticipants.forEach((p) => { nameMap[p.clerkId] = p.name; });

    if (session.actionItems && session.actionItems.length > 0) {
      session.actionItems = session.actionItems.map(ai => ({
        ...ai,
        assigneeName: ai.assignee ? (nameMap[ai.assignee] || "Unknown user") : "Unassigned"
      }));
    }

    const result = await doSyncMeetingToNotion(session, team);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in syncMeetingToNotion:", error.message);
    res.status(400).json({ message: error.message });
  }
}
