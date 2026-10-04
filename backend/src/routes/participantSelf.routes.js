import { Router } from "express";
import { getParticipantOnboarding } from "../controllers/participant.controller.js";
import { requireParticipant } from "../middlewares/auth.js";

const router = Router();

router.get("/onboarding", requireParticipant, getParticipantOnboarding);

export default router;
