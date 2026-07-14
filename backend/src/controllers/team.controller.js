import asyncHandler from "express-async-handler";
import Invite from "../models/Invite.js";
import Team from "../models/Team.js";
import User from "../models/User.js";
import { resolveParticipants } from "../lib/resolveParticipants.js";

/**
 * POST /api/teams
 * body: { name, description?, memberClerkIds?: string[] }
 */
const createTeam = asyncHandler(async (req, res) => {
  const { name, description = "", memberClerkIds = [] } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("Team name is required");
  }

  const adminId = req.user.clerkId;
  const members = Array.from(new Set([adminId, ...memberClerkIds]));

  const team = await Team.create({ name, description, admin: adminId, members });

  // Keep each User's teams[] array in sync for fast "my teams" lookups
  await User.updateMany({ clerkId: { $in: members } }, { $addToSet: { teams: team._id } });

  res.status(201).json(team);
});

/**
 * GET /api/teams
 * Lists teams the current user belongs to.
 */
const getTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ members: req.user.clerkId }).sort({ name: 1 });
  res.status(200).json(teams);
});

/**
 * GET /api/teams/:id
 */
const getTeamById = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }

  if (!team.members.includes(req.user.clerkId)) {
    res.status(403);
    throw new Error("You are not a member of this team");
  }

  res.status(200).json(team);
});

/**
 * POST /api/teams/:id/members
 * body: { clerkId }
 * Only the team admin can add members.
 */
const addTeamMember = asyncHandler(async (req, res) => {
  const { clerkId } = req.body;
  const team = await Team.findById(req.params.id);

  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }

  if (team.admin !== req.user.clerkId) {
    res.status(403);
    throw new Error("Only the team admin can add members");
  }

  if (!clerkId) {
    res.status(400);
    throw new Error("clerkId is required");
  }

  if (!team.members.includes(clerkId)) {
    team.members.push(clerkId);
    await team.save();
    await User.updateOne({ clerkId }, { $addToSet: { teams: team._id } });
  }

  res.status(200).json(team);
});

/**
 * DELETE /api/teams/:id/members/:clerkId
 * Only the team admin can remove members (and cannot remove themselves this way).
 */
const removeTeamMember = asyncHandler(async (req, res) => {
  const { id, clerkId } = req.params;
  const team = await Team.findById(id);

  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }

  if (team.admin !== req.user.clerkId) {
    res.status(403);
    throw new Error("Only the team admin can remove members");
  }

  if (clerkId === team.admin) {
    res.status(400);
    throw new Error("Cannot remove the team admin");
  }

  team.members = team.members.filter((m) => m !== clerkId);
  await team.save();
  await User.updateOne({ clerkId }, { $pull: { teams: team._id } });

  res.status(200).json(team);
});

/**
 * GET /api/teams/:id/members
 */
const getTeamMembers = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }

  if (!team.members.includes(req.user.clerkId)) {
    res.status(403);
    throw new Error("You are not a member of this team");
  }

  const resolved = await resolveParticipants(team.members);
  const membersWithAdmin = resolved.map((member) => {
    const memberObj = member.toObject ? member.toObject() : member;
    return {
      ...memberObj,
      isAdmin: member.clerkId === team.admin,
    };
  });

  res.status(200).json(membersWithAdmin);
});

/**
 * POST /api/teams/:id/members/invite
 * body: { email }
 */
const inviteTeamMemberByEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const team = await Team.findById(req.params.id);

  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }

  if (team.admin !== req.user.clerkId) {
    res.status(403);
    throw new Error("Only the team admin can invite members");
  }

  if (!email) {
    res.status(400);
    throw new Error("email is required");
  }

  const invitedUser = await User.findOne({ email });
  if (!invitedUser) {
    res.status(404);
    throw new Error("No IntellMeet account found for this email yet — they'll need to sign up first before you can add them.");
  }

  const clerkId = invitedUser.clerkId;

  if (team.members.includes(clerkId)) {
    res.status(400);
    throw new Error(`${invitedUser.name} is already a member of this team`);
  }

  const existingInvite = await Invite.findOne({ team: team._id, invitedClerkId: clerkId, status: "pending" });
  if (existingInvite) {
    res.status(400);
    throw new Error(`${invitedUser.name} already has a pending invite to this team`);
  }

  await Invite.create({
    team: team._id,
    teamName: team.name,
    invitedClerkId: clerkId,
    invitedByClerkId: req.user.clerkId,
    invitedByName: req.user.name,
  });

  res.status(200).json({ message: `Invite sent to ${invitedUser.name}` });
});

const getMyInvites = asyncHandler(async (req, res) => {
  const invites = await Invite.find({ invitedClerkId: req.user.clerkId, status: "pending" }).sort({ createdAt: -1 });
  res.status(200).json(invites);
});

const acceptInvite = asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite || invite.invitedClerkId !== req.user.clerkId) {
    res.status(404);
    throw new Error("Invite not found");
  }
  if (invite.status !== "pending") {
    res.status(400);
    throw new Error("This invite has already been responded to");
  }

  const team = await Team.findById(invite.team);
  if (team && !team.members.includes(req.user.clerkId)) {
    team.members.push(req.user.clerkId);
    await team.save();
    await User.updateOne({ clerkId: req.user.clerkId }, { $addToSet: { teams: team._id } });
  }

  await invite.deleteOne();
  res.status(200).json({ message: "Invite accepted" });
});

const declineInvite = asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite || invite.invitedClerkId !== req.user.clerkId) {
    res.status(404);
    throw new Error("Invite not found");
  }
  await invite.deleteOne();
  res.status(200).json({ message: "Invite declined" });
});

const leaveTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }
  if (team.admin === req.user.clerkId) {
    res.status(400);
    throw new Error("The team admin cannot leave the team");
  }
  if (!team.members.includes(req.user.clerkId)) {
    res.status(400);
    throw new Error("You are not a member of this team");
  }
  team.members = team.members.filter((m) => m !== req.user.clerkId);
  await team.save();
  await User.updateOne({ clerkId: req.user.clerkId }, { $pull: { teams: team._id } });
  res.status(200).json({ message: "Left the team" });
});

const updateTeamIntegrations = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    res.status(404);
    throw new Error("Team not found");
  }

  if (team.admin !== req.user.clerkId) {
    res.status(403);
    throw new Error("Only the team admin can update integrations");
  }

  const { slackWebhookUrl, notionToken, notionPageId } = req.body;

  if (slackWebhookUrl !== undefined) team.slackWebhookUrl = slackWebhookUrl;
  if (notionToken !== undefined) team.notionToken = notionToken;
  if (notionPageId !== undefined) team.notionPageId = notionPageId;

  await team.save();
  res.status(200).json(team);
});

export { 
  createTeam, 
  getTeams, 
  getTeamById, 
  addTeamMember, 
  removeTeamMember,
  getTeamMembers,
  inviteTeamMemberByEmail,
  getMyInvites,
  acceptInvite,
  declineInvite,
  leaveTeam,
  updateTeamIntegrations
};