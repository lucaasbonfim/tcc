import { Router } from "express";
import {
  completeManualExperimentTaskController,
  generateSimplePromptResultController,
  getExperimentTaskAiRun,
  getExperimentTaskById,
  getManualExperimentTaskResult,
  previewExperimentTaskPromptController,
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
router.post("/:id/prompt/preview", previewExperimentTaskPromptController);
router.post("/:id/generate", generateSimplePromptResultController);
router.get("/:id/ai-run", getExperimentTaskAiRun);
router.get("/:id/result", getManualExperimentTaskResult);
router.get("/:taskId/test-cases", listExperimentTaskTestCases);
router.post("/:taskId/test-cases", createManualTestCaseController);
router.put("/:taskId/test-cases/:testCaseId", updateManualTestCaseController);
router.delete("/:taskId/test-cases/:testCaseId", deleteManualTestCaseController);
router.get("/:id", getExperimentTaskById);

export default router;
