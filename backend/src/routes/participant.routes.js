import { Router } from "express";
import { createParticipantController } from "../controllers/participant.controller.js";

const router = Router();

router.post("/", createParticipantController);

export default router;
