import express from "express";
import { protect, attachUser } from "../middleware/auth.middleware.js";
import { getMyInvites, acceptInvite, declineInvite } from "../controllers/team.controller.js";

const router = express.Router();

router.use(protect, attachUser);

router.get("/", getMyInvites);
router.post("/:id/accept", acceptInvite);
router.post("/:id/decline", declineInvite);

export default router;
