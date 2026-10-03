import { Router } from "express";
import {
  completeManualExperimentTaskController,
  getExperimentTaskById,
  getManualExperimentTaskResult,
  startExperimentTaskController,
} from "../controllers/experimentTask.controller.js";
import {
  createManualTestCaseController,
  deleteManualTestCaseController,
  listExperimentTaskTestCases,
  updateManualTestCaseController,
} from "../controllers/testCase.controller.js";

const router = Router();

router.patch("/:id/start", startExperimentTaskController);
router.patch("/:id/complete", completeManualExperimentTaskController);
router.get("/:id/result", getManualExperimentTaskResult);
router.get("/:taskId/test-cases", listExperimentTaskTestCases);
router.post("/:taskId/test-cases", createManualTestCaseController);
router.put("/:taskId/test-cases/:testCaseId", updateManualTestCaseController);
router.delete("/:taskId/test-cases/:testCaseId", deleteManualTestCaseController);
router.get("/:id", getExperimentTaskById);

export default router;
