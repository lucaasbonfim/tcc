import { Router } from "express";
import {
  getParticipantDetails,
  listExperimentTasks,
  listParticipantsProgress,
} from "../controllers/admin.controller.js";

const router = Router();

router.get("/experiment-tasks", listExperimentTasks);
router.get("/participants", listParticipantsProgress);
router.get("/participants/:id", getParticipantDetails);

export default router;
