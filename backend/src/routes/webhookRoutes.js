import express from "express";
import { handleStreamVideoWebhook } from "../controllers/webhook_controller.js";

const router = express.Router();

router.post("/stream/video", handleStreamVideoWebhook);

export default router;
