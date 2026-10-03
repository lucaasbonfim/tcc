import { Router } from "express";
import {
  createParticipantController,
  listParticipants,
} from "../controllers/participant.controller.js";

const router = Router();

router.get("/", listParticipants);
router.post("/", createParticipantController);

export default router;
