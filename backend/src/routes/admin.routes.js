import { Router } from "express";
import {
  getParticipantDetails,
  listParticipantsProgress,
} from "../controllers/admin.controller.js";

const router = Router();

router.get("/participants", listParticipantsProgress);
router.get("/participants/:id", getParticipantDetails);

export default router;
