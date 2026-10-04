import { Router } from "express";
import {
  requireAdmin,
  requireParticipant,
  requireSameParticipant,
} from "../middlewares/auth.js";
import {
  deleteParticipantController,
  getParticipantByCode,
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

router.get("/", requireAdmin, listParticipants);
router.post("/", (_request, response) =>
  response.status(410).json({
    error:
      "Cadastro publico de participantes desativado. Utilize a area administrativa.",
  }),
);
router.get("/by-code/:code", getParticipantByCode);
router.get(
  "/:participantId/experiment-tasks",
  requireParticipant,
  requireSameParticipant(),
  listParticipantExperimentTasks,
);
router.get(
  "/:participantId/experiment-tasks/next",
  requireParticipant,
  requireSameParticipant(),
  getNextParticipantExperimentTask,
);
router.post(
  "/:participantId/experiment-tasks/initialize",
  requireParticipant,
  requireSameParticipant(),
  initializeParticipantExperimentTasksController,
);
router.get(
  "/:participantId/profile",
  requireParticipant,
  requireSameParticipant(),
  getParticipantProfile,
);
router.post(
  "/:participantId/profile",
  requireParticipant,
  requireSameParticipant(),
  createParticipantProfileController,
);
router.put(
  "/:participantId/profile",
  requireParticipant,
  requireSameParticipant(),
  updateParticipantProfileController,
);
router.get(
  "/:id",
  requireParticipant,
  requireSameParticipant("id"),
  getParticipantById,
);
router.put("/:id", requireAdmin, updateParticipantController);
router.delete("/:id", requireAdmin, deleteParticipantController);

export default router;
