import { Router } from "express";
import {
  createParticipantController,
  deleteParticipantController,
  getParticipantById,
  listParticipants,
  updateParticipantController,
} from "../controllers/participant.controller.js";
import { createParticipantProfileController } from "../controllers/participantProfile.controller.js";

const router = Router();

router.get("/", listParticipants);
router.post("/", createParticipantController);
router.post("/:participantId/profile", createParticipantProfileController);
router.get("/:id", getParticipantById);
router.put("/:id", updateParticipantController);
router.delete("/:id", deleteParticipantController);

export default router;
