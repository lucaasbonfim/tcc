import { Router } from "express";
import {
  getExperimentTaskById,
  startExperimentTaskController,
} from "../controllers/experimentTask.controller.js";
import {
  createManualTestCaseController,
  listExperimentTaskTestCases,
  updateManualTestCaseController,
} from "../controllers/testCase.controller.js";

const router = Router();

router.patch("/:id/start", startExperimentTaskController);
router.get("/:taskId/test-cases", listExperimentTaskTestCases);
router.post("/:taskId/test-cases", createManualTestCaseController);
router.put("/:taskId/test-cases/:testCaseId", updateManualTestCaseController);
router.get("/:id", getExperimentTaskById);

export default router;
