import { Router } from "express";
import {
  requireExperimentTaskOwner,
  requireParticipant,
} from "../middlewares/auth.js";
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

router.use(requireParticipant);

router.patch(
  "/:id/start",
  requireExperimentTaskOwner(),
  startExperimentTaskController,
);
router.patch(
  "/:id/complete",
  requireExperimentTaskOwner(),
  completeManualExperimentTaskController,
);
router.post(
  "/:id/prompt/preview",
  requireExperimentTaskOwner(),
  previewExperimentTaskPromptController,
);
router.post(
  "/:id/generate",
  requireExperimentTaskOwner(),
  generateSimplePromptResultController,
);
router.get("/:id/ai-run", requireExperimentTaskOwner(), getExperimentTaskAiRun);
router.get(
  "/:id/result",
  requireExperimentTaskOwner(),
  getManualExperimentTaskResult,
);
router.get(
  "/:taskId/test-cases",
  requireExperimentTaskOwner("taskId"),
  listExperimentTaskTestCases,
);
router.post(
  "/:taskId/test-cases",
  requireExperimentTaskOwner("taskId"),
  createManualTestCaseController,
);
router.put(
  "/:taskId/test-cases/:testCaseId",
  requireExperimentTaskOwner("taskId"),
  updateManualTestCaseController,
);
router.delete(
  "/:taskId/test-cases/:testCaseId",
  requireExperimentTaskOwner("taskId"),
  deleteManualTestCaseController,
);
router.get("/:id", requireExperimentTaskOwner(), getExperimentTaskById);

export default router;
