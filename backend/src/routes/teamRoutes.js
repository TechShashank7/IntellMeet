import express from "express";
import { protect, attachUser } from "../middleware/auth.middleware.js";
import {
  createTeam,
  getTeams,
  getTeamById,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  inviteTeamMemberByEmail,
  leaveTeam,
  updateTeamIntegrations,
} from "../controllers/team.controller.js";

const router = express.Router();

router.use(protect, attachUser);

router.post("/", createTeam);
router.get("/", getTeams); // teams the user belongs to
router.get("/:id", getTeamById);
router.post("/:id/members", addTeamMember); // body: { clerkId }
router.delete("/:id/members/:clerkId", removeTeamMember);
router.get("/:id/members", getTeamMembers);
router.post("/:id/members/invite", inviteTeamMemberByEmail);
router.post("/:id/leave", leaveTeam);
router.patch("/:id/integrations", updateTeamIntegrations);

export default router;