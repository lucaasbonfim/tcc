import { Router } from "express";
import {
  createParticipantController,
  deleteParticipantController,
  getParticipantById,
  listParticipants,
  updateParticipantController,
} from "../controllers/participant.controller.js";
import {
  createParticipantProfileController,
  getParticipantProfile,
  updateParticipantProfileController,
} from "../controllers/participantProfile.controller.js";
import {
  getNextParticipantExperimentTask,
  initializeParticipantExperimentTasksController,
  listParticipantExperimentTasks,
} from "../controllers/experimentTask.controller.js";

const router = Router();

router.get("/", listParticipants);
router.post("/", createParticipantController);
router.get("/:participantId/experiment-tasks", listParticipantExperimentTasks);
router.get(
  "/:participantId/experiment-tasks/next",
  getNextParticipantExperimentTask,
);
router.post(
  "/:participantId/experiment-tasks/initialize",
  initializeParticipantExperimentTasksController,
);
router.get("/:participantId/profile", getParticipantProfile);
router.post("/:participantId/profile", createParticipantProfileController);
router.put("/:participantId/profile", updateParticipantProfileController);
router.get("/:id", getParticipantById);
router.put("/:id", updateParticipantController);
router.delete("/:id", deleteParticipantController);

export default router;
