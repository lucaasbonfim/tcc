import { Router } from "express";
import {
  createParticipantController,
  getParticipantById,
  listParticipants,
} from "../controllers/participant.controller.js";

const router = Router();

router.get("/", listParticipants);
router.post("/", createParticipantController);
router.get("/:id", getParticipantById);

export default router;
