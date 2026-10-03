import { Router } from "express";
import {
  createParticipantController,
  getParticipantById,
  listParticipants,
  updateParticipantController,
} from "../controllers/participant.controller.js";

const router = Router();

router.get("/", listParticipants);
router.post("/", createParticipantController);
router.get("/:id", getParticipantById);
router.put("/:id", updateParticipantController);

export default router;
