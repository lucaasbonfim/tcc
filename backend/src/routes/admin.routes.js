import { Router } from "express";
import { requireAdmin } from "../middlewares/auth.js";
import {
  createParticipantAccessController,
  exportExperimentCsv,
  exportExperimentJson,
  exportExperimentXlsx,
  getParticipantDetails,
  listExperimentTasks,
  listParticipantsProgress,
  showExperimentSummary,
} from "../controllers/admin.controller.js";

const router = Router();

router.use(requireAdmin);

router.get("/export/csv", exportExperimentCsv);
router.get("/export/json", exportExperimentJson);
router.get("/export/xls", exportExperimentXlsx);
router.get("/export/xlsx", exportExperimentXlsx);
router.get("/experiment-tasks", listExperimentTasks);
router.get("/experiment-summary", showExperimentSummary);
router.post("/participants", createParticipantAccessController);
router.get("/participants", listParticipantsProgress);
router.get("/participants/:id", getParticipantDetails);

export default router;
