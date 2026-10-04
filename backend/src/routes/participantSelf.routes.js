import { Router } from "express";
import {
  confirmParticipantConsent,
  getParticipantOnboarding,
} from "../controllers/participant.controller.js";
import { requireParticipant } from "../middlewares/auth.js";

const router = Router();

router.get("/onboarding", requireParticipant, getParticipantOnboarding);
router.post("/consent", requireParticipant, confirmParticipantConsent);

export default router;
