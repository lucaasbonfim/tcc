import { Router } from "express";
import {
  exportExperimentCsv,
  exportExperimentJson,
  exportExperimentXls,
  getParticipantDetails,
  listExperimentTasks,
  listParticipantsProgress,
  showExperimentSummary,
} from "../controllers/admin.controller.js";

const router = Router();

router.get("/export/csv", exportExperimentCsv);
router.get("/export/json", exportExperimentJson);
router.get("/export/xls", exportExperimentXls);
router.get("/experiment-tasks", listExperimentTasks);
router.get("/experiment-summary", showExperimentSummary);
router.get("/participants", listParticipantsProgress);
router.get("/participants/:id", getParticipantDetails);

export default router;
